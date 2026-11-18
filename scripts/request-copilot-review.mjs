#!/usr/bin/env node
// Ask GitHub Copilot to review a pull request, but only when it is worth the
// credits, and at a stated effort level. Run by the session that opens the pull
// request, right after opening it:
//
//   node scripts/request-copilot-review.mjs <pr>              first review, Lite
//   node scripts/request-copilot-review.mjs <pr> --again      one more, after fixes
//   node scripts/request-copilot-review.mjs <pr> --balanced   a deeper (dearer) review
//   node scripts/request-copilot-review.mjs <pr> --status     what Copilot has said so far
//   node scripts/request-copilot-review.mjs <pr> --dry-run    decide, but do not ask
//
// Why a script and not a GitHub setting: automatic review is all or nothing. It
// cannot skip docs-only pull requests, and two thirds of this repo's pull requests
// are docs-only. This asks through GitHub's own `requestCopilotCodeReview` call,
// under the owner's GitHub sign-in, so no token is stored anywhere and the review
// is charged to his Copilot plan.
//
// Why the effort is passed on every request: the account is set to Lite and the
// repository reports Lite as its effective level, yet a review requested without
// an explicit effort on #516 (2026-11-18) ran at Balanced. Stating the effort in
// the request does not depend on which setting wins.
//
// Rules it applies:
//   - Docs-only (every changed file is under docs/ or is a .md file): no review.
//   - Draft: no review.
//   - Lite unless --balanced is passed.
//   - At most MAX_REVIEWS Copilot reviews per pull request. The first is the
//     default; a second needs --again. A third is refused unless --owner-asked is
//     passed, which is only for a review Giorgio asked for in his own words.
//   - "Requested" is reported only when GitHub's answer says the request exists.
//     A refusal is reported with GitHub's own reason (no credit left, and so on).
//
// GitHub does NOT list Copilot under a pull request's requested reviewers
// (`gh pr view --json reviewRequests` and the REST `requested_reviewers` endpoint
// both stay empty while Copilot is reviewing; seen on #516). The pull request's
// timeline does record the request, so a pending review is read from there.
import { spawnSync } from 'node:child_process';

const MAX_REVIEWS = 2;
const COPILOT = /copilot/i;
// Paths that are not code. Everything else counts as code, so a new kind of file
// is reviewed by default rather than skipped by default.
const isDocs = (p) => p.startsWith('docs/') || /\.(md|mdx|txt)$/i.test(p);
// Worth considering --balanced; the script only says so.
const isSensitive = (p) =>
  p.startsWith('supabase/migrations/') || p.startsWith('supabase/functions/') || p.startsWith('.github/workflows/');

const args = process.argv.slice(2);
const pr = args.find((a) => /^\d+$/.test(a));
const has = (f) => args.includes(f);
if (!pr) {
  console.error('usage: node scripts/request-copilot-review.mjs <pr-number> [--again] [--balanced] [--status] [--dry-run] [--owner-asked]');
  process.exit(2);
}
const effort = has('--balanced') ? 'BALANCED' : 'LITE';

const gh = (...a) => spawnSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const die = (msg) => { console.error(msg); process.exit(2); };
const graphql = (query, vars = {}) => {
  const r = gh('api', 'graphql', '-f', `query=${query}`, ...Object.entries(vars).flatMap(([k, v]) => ['-f', `${k}=${v}`]));
  let body;
  try { body = JSON.parse(r.stdout); } catch { die(`GitHub did not answer for pull request ${pr}: ${r.stderr || r.error?.message}`); }
  if (body.errors?.length) die(`GitHub refused the query for pull request ${pr}: ${body.errors.map((e) => e.message).join('; ')}`);
  return body.data;
};

const repo = gh('repo', 'view', '--json', 'owner,name');
if (repo.status !== 0) die(`could not read the repository: ${repo.stderr}`);
const { owner, name } = JSON.parse(repo.stdout);

// `gh api graphql -f` sends every variable as a string, so the number goes in the query text.
const readPr = () => graphql(
  `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){pullRequest(number:${Number(pr)}){
     id number state isDraft headRefOid
     files(first:100){totalCount nodes{path}}
     reviews(first:100){nodes{isCopilotCodeReview copilotCodeReviewEffort submittedAt commit{oid}}}
     reviewThreads(first:100){nodes{isResolved isOutdated path line
       comments(first:1){nodes{databaseId isCopilotCodeReview body originalCommit{oid}}}}}
   }}}`,
  { owner: owner.login, name },
).repository.pullRequest;

// When Copilot was last asked, from the timeline (see the note at the top).
const lastRequestAt = () => {
  const r = gh('api', `repos/${owner.login}/${name}/issues/${pr}/timeline`, '--paginate', '--jq',
    '.[] | select(.event=="review_requested") | [(.requested_reviewer.login // ""), .created_at] | @tsv');
  if (r.status !== 0) die(`could not read the timeline of pull request ${pr}: ${r.stderr || r.error?.message}`);
  return r.stdout.split('\n').filter(Boolean).map((l) => l.split('\t'))
    .filter(([who]) => COPILOT.test(who)).map(([, at]) => at).sort().at(-1) ?? null;
};

const d = readPr();
if (!d) die(`pull request ${pr} was not found`);
const say = (verdict, why) => console.log(`#${d.number} ${verdict}: ${why}`);
const done = d.reviews.nodes.filter((v) => v.isCopilotCodeReview).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
const requestedAt = lastRequestAt();
const pending = Boolean(requestedAt) && (done.length === 0 || requestedAt > done.at(-1).submittedAt);
const short = (oid) => (oid ?? '').slice(0, 8);

if (has('--status')) {
  console.log(`#${d.number} head ${short(d.headRefOid)}; Copilot reviews: ${done.length} of ${MAX_REVIEWS}${pending ? `; one pending since ${requestedAt}` : ''}`);
  for (const v of done) {
    console.log(`  review ${v.submittedAt} on ${short(v.commit?.oid)}${v.commit?.oid === d.headRefOid ? ' (current commit)' : ' (an earlier commit)'}; effort ${v.copilotCodeReviewEffort ?? 'not recorded'}`);
  }
  const threads = d.reviewThreads.nodes.filter((t) => t.comments.nodes[0]?.isCopilotCodeReview);
  const open = threads.filter((t) => !t.isResolved && !t.isOutdated);
  console.log(`  findings: ${threads.length} in all; ${open.length} still to answer`);
  for (const t of threads) {
    const c = t.comments.nodes[0];
    const state = t.isResolved ? 'resolved, nothing to do' : t.isOutdated ? 'outdated (the code it points at has changed): check, then resolve' : 'OPEN';
    console.log(`  [${state}] comment ${c.databaseId} ${t.path}${t.line ? `:${t.line}` : ''} (raised on ${short(c.originalCommit?.oid)}): ${c.body.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
  process.exit(0);
}

if (d.state !== 'OPEN') { say('SKIPPED', `the pull request is ${d.state.toLowerCase()}`); process.exit(0); }
if (d.isDraft) { say('SKIPPED', 'draft'); process.exit(0); }
// Only the first 100 files are read. A pull request larger than that is code for this purpose.
const files = d.files.nodes.map((f) => f.path);
const code = files.filter((p) => !isDocs(p));
if (d.files.totalCount <= 100 && code.length === 0) {
  say('SKIPPED', `docs-only (${files.length} files)`);
  process.exit(0);
}

if (pending) { say('ALREADY REQUESTED', `Copilot has had a review pending since ${requestedAt}`); process.exit(0); }
if (done.some((v) => v.commit?.oid === d.headRefOid) && !has('--owner-asked')) {
  say('ALREADY REVIEWED', `Copilot reviewed the current commit ${short(d.headRefOid)}`);
  process.exit(0);
}
if (done.length >= MAX_REVIEWS && !has('--owner-asked')) {
  say('REFUSED', `${done.length} Copilot reviews already; the limit is ${MAX_REVIEWS}. This pull request goes to the owner.`);
  process.exit(1);
}
if (done.length >= 1 && !has('--again') && !has('--owner-asked')) {
  say('SKIPPED', 'Copilot already reviewed an earlier commit. Pass --again for one more review after the fixes are pushed.');
  process.exit(0);
}

const sensitive = code.filter(isSensitive);
if (sensitive.length && effort === 'LITE') {
  console.log(`note: touches ${sensitive.length} migration, edge-function or workflow files. If the change is security-sensitive, the owner may want --balanced.`);
}
const what = `${code.length} code files of ${d.files.totalCount}; effort ${effort}; review ${done.length + 1}${has('--owner-asked') ? ' (asked for by the owner)' : ` of ${MAX_REVIEWS}`}`;
if (has('--dry-run')) { say('WOULD REQUEST', what); process.exit(0); }

const res = graphql(
  `mutation($id:ID!,$effort:CopilotCodeReviewEffort!){requestCopilotCodeReview(input:{pullRequestId:$id,reviewEffort:$effort}){success failureReason reviewRequest{id}}}`,
  { id: d.id, effort },
).requestCopilotCodeReview;
// GitHub's own answer is the effect: a request object, and no failure reason.
if (res.success && !res.failureReason && res.reviewRequest) { say('REQUESTED', what); process.exit(0); }
if (res.failureReason === 'REQUEST_CONFLICT') { say('ALREADY REQUESTED', 'GitHub says a Copilot review is already pending'); process.exit(0); }
const reasons = {
  NO_QUOTA_REMAINING: 'no Copilot credit is left this month (the budget stop has been reached). Tell the owner; do not retry.',
  ACTOR_INELIGIBLE: 'this GitHub account cannot request Copilot reviews.',
  REPOSITORY_INELIGIBLE: 'this repository is not eligible for Copilot reviews.',
  APP_NOT_INSTALLED: 'the Copilot reviewer app is not installed on this repository.',
  LICENSED_ORGANIZATION_UNAVAILABLE: 'the Copilot licence is unavailable.',
};
console.error(`#${d.number} NOT REQUESTED: ${reasons[res.failureReason] ?? `GitHub gave no request and the reason "${res.failureReason}".`}`);
process.exit(1);
