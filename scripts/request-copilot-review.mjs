#!/usr/bin/env node
// Ask GitHub Copilot to review a pull request, but only when it is worth the
// credits. Run by the session that opens the pull request, right after opening it:
//
//   node scripts/request-copilot-review.mjs <pr-number>          first review
//   node scripts/request-copilot-review.mjs <pr-number> --again  one more, after fixes
//   node scripts/request-copilot-review.mjs <pr-number> --dry-run
//
// Why a script and not a GitHub setting: automatic review is all or nothing. It
// cannot skip docs-only pull requests, and two thirds of this repo's pull requests
// are docs-only. This uses the one documented per-pull-request way to ask
// (`gh pr edit --add-reviewer @copilot`), under the owner's own GitHub sign-in, so
// no token is stored anywhere and the review is charged to his Copilot plan.
//
// Rules it applies:
//   - Docs-only (every changed file is under docs/ or is a .md file): no review.
//   - Draft: no review.
//   - At most MAX_REVIEWS Copilot reviews per pull request. The first is the
//     default; a second needs --again. A third is refused: by then the pull
//     request goes to the owner, not back round the loop.
//   - It never reports "requested" unless GitHub shows the request or a review.
import { spawnSync } from 'node:child_process';

const MAX_REVIEWS = 2;
const COPILOT = /copilot/i;
// Paths that are not code. Everything else counts as code, so a new kind of file
// is reviewed by default rather than skipped by default.
const isDocs = (p) => p.startsWith('docs/') || /\.(md|mdx|txt)$/i.test(p);
// Worth a second look at a higher effort setting; the script only says so.
const isSensitive = (p) =>
  p.startsWith('supabase/migrations/') || p.startsWith('supabase/functions/') || p.startsWith('.github/workflows/');

const args = process.argv.slice(2);
const pr = args.find((a) => /^\d+$/.test(a));
const again = args.includes('--again');
const dryRun = args.includes('--dry-run');
if (!pr) {
  console.error('usage: node scripts/request-copilot-review.mjs <pr-number> [--again] [--dry-run]');
  process.exit(2);
}

const gh = (...a) => spawnSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const view = () => {
  const r = gh('pr', 'view', pr, '--json', 'number,state,isDraft,headRefOid,files,reviews,reviewRequests,url');
  if (r.status !== 0) {
    console.error(`could not read pull request ${pr}: ${r.stderr || r.error?.message}`);
    process.exit(2);
  }
  return JSON.parse(r.stdout);
};
const copilotReviews = (d) => d.reviews.filter((v) => COPILOT.test(v.author?.login ?? ''));
const copilotRequested = (d) => d.reviewRequests.some((q) => COPILOT.test(q.login ?? q.name ?? q.slug ?? ''));

const d = view();
const say = (verdict, why) => console.log(`#${d.number} ${verdict}: ${why}`);

if (d.state !== 'OPEN') { say('SKIPPED', `the pull request is ${d.state.toLowerCase()}`); process.exit(0); }
if (d.isDraft) { say('SKIPPED', 'draft'); process.exit(0); }
// `gh` returns at most 100 files. A pull request that large is code for this purpose.
const files = d.files.map((f) => f.path);
const code = files.filter((p) => !isDocs(p));
if (files.length < 100 && code.length === 0) {
  say('SKIPPED', `docs-only (${files.length} files)`);
  process.exit(0);
}

const done = copilotReviews(d);
const onHead = done.some((v) => v.commit?.oid === d.headRefOid);
if (copilotRequested(d)) { say('ALREADY REQUESTED', 'Copilot has a review pending'); process.exit(0); }
if (onHead) { say('ALREADY REVIEWED', `Copilot reviewed the current commit ${d.headRefOid.slice(0, 8)}`); process.exit(0); }
if (done.length >= MAX_REVIEWS) {
  say('REFUSED', `${done.length} Copilot reviews already; the limit is ${MAX_REVIEWS}. This pull request goes to the owner.`);
  process.exit(1);
}
if (done.length >= 1 && !again) {
  say('SKIPPED', 'Copilot already reviewed an earlier commit. Pass --again for one more review after the fixes are pushed.');
  process.exit(0);
}

const sensitive = code.filter(isSensitive);
if (sensitive.length) {
  console.log(`note: touches ${sensitive.length} migration, edge-function or workflow files. If the change is security-sensitive, the owner may want a Balanced review.`);
}
if (dryRun) { say('WOULD REQUEST', `${code.length} code files of ${files.length}; review ${done.length + 1} of ${MAX_REVIEWS}`); process.exit(0); }

const r = gh('pr', 'edit', pr, '--add-reviewer', '@copilot');
if (r.status !== 0) {
  console.error(`#${d.number} FAILED: gh could not request the review.\n${r.stderr}`);
  process.exit(1);
}
// Verify the effect, not the exit code: the request (or an instant review) must show on the pull request.
const after = view();
if (copilotRequested(after) || copilotReviews(after).length > done.length) {
  say('REQUESTED', `${code.length} code files of ${files.length}; review ${done.length + 1} of ${MAX_REVIEWS}`);
  process.exit(0);
}
console.error(`#${d.number} FAILED: gh reported success but no Copilot review request shows on the pull request. The monthly AI-credit budget may be used up; check Settings > Billing and licensing.`);
process.exit(1);
