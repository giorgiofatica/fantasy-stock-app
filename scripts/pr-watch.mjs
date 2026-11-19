#!/usr/bin/env node
// One look at every open pull request, for the session that watches them.
//
//   node scripts/pr-watch.mjs          list what needs attention; exit 1 if anything does
//   node scripts/pr-watch.mjs --all    also list the pull requests that are fine
//   node scripts/pr-watch.mjs --ignore 279   leave out a pull request parked on purpose
//
// Why this exists: the desktop app's Auto-fix wakes only the session a pull
// request is bound to, and only if that session switched it on. A pull request
// made from a worker's branch is bound to the worker, so a conflict or a red
// check on it can wake nobody (#546 and #547, 2026-11-18: Giorgio noticed
// first). This asks GitHub directly, for all of them, whoever opened them.
//
// It only reads. It never fixes, pushes, comments, resolves or merges.
//
// What counts as needing attention:
//   - CONFLICT   the pull request no longer merges with main
//   - RED        a check has failed
//   - FINDINGS   Copilot has review threads that are not resolved and not outdated
//   - BEHIND     the pull request has not been tested on top of the newest main. The
//                merge rule requires that (Giorgio, 2026-11-19), so it cannot merge
//                until main is merged into its branch and the checks pass again
//   - MAIN RED   the newest commit on main has a failed check. Two pull requests can
//                each be green and still break main together (#554 + #555, 2026-11-19),
//                and nothing on a pull request shows that
// Reported but not counted, because they clear by themselves:
//   - CHECKING   GitHub has not finished working out whether it merges (this can
//                last several minutes after a push; it is not a conflict)
//   - RUNNING    checks are still running
import { spawnSync } from 'node:child_process';

const showAll = process.argv.includes('--all');
// --ignore 279,301: pull requests that are parked on purpose (say why in the pipeline guide).
const ignoreArg = process.argv[process.argv.indexOf('--ignore') + 1] ?? '';
const ignored = new Set(process.argv.includes('--ignore') ? ignoreArg.split(',').map(Number) : []);
const gh = (...a) => spawnSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const die = (m) => { console.error(m); process.exit(2); };

const repo = gh('repo', 'view', '--json', 'owner,name');
if (repo.status !== 0) die(`could not read the repository: ${repo.stderr}`);
const { owner, name } = JSON.parse(repo.stdout);

const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
  defaultBranchRef{name target{... on Commit{oid statusCheckRollup{state contexts(first:50){totalCount nodes{
    __typename ... on CheckRun{name status conclusion} ... on StatusContext{context state}}}}}}}
  pullRequests(states:OPEN,first:50,orderBy:{field:CREATED_AT,direction:ASC}){totalCount nodes{
    number title isDraft mergeable mergeStateStatus headRefName
    commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:50){nodes{
      __typename ... on CheckRun{name status conclusion} ... on StatusContext{context state}}}}}}}
    reviewThreads(first:100){nodes{isResolved isOutdated comments(first:1){nodes{isCopilotCodeReview}}}}
  }}}}`;
const r = gh('api', 'graphql', '-f', `query=${query}`, '-f', `owner=${owner.login}`, '-f', `name=${name}`);
let body;
try { body = JSON.parse(r.stdout); } catch { die(`GitHub did not answer: ${r.stderr || r.error?.message}`); }
if (body.errors?.length) die(`GitHub refused the query: ${body.errors.map((e) => e.message).join('; ')}`);
const prs = body.data.repository.pullRequests;
// A truncated list must not read as "all clear" for the ones it left out.
if (prs.totalCount > prs.nodes.length) die(`only ${prs.nodes.length} of ${prs.totalCount} open pull requests were read; this script must page before it can be trusted`);

const BAD = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
let needing = 0;
const main = body.data.repository.defaultBranchRef;
const mainRollup = main?.target?.statusCheckRollup ?? null;
const mainCtx = mainRollup?.contexts.nodes ?? [];
const mainTotal = mainRollup?.contexts.totalCount ?? mainCtx.length;
const mainFailed = mainCtx.filter((c) => BAD.has(c.conclusion ?? '') || BAD.has(c.state ?? '')).map((c) => c.name ?? c.context);
const mainRunning = mainCtx.filter((c) => (c.__typename === 'CheckRun' ? c.status !== 'COMPLETED' : c.state === 'PENDING'));
// The verdict comes from the rollup's own state, which GitHub computes over EVERY check, not from the first page
// of names: a failure past the 50th context must still read as red (Copilot on #564). The names are only a list.
const rollupRed = mainRollup?.state === 'FAILURE' || mainRollup?.state === 'ERROR';
const unread = mainTotal > mainCtx.length ? ` (names from ${mainCtx.length} of ${mainTotal} checks)` : '';
let mainRed = false;
if (mainFailed.length || rollupRed) {
  mainRed = true;
  const names = mainFailed.length ? mainFailed.join(', ') : 'a check not among those listed';
  console.log(`NEEDS ATTENTION ${main.name} @ ${main.target.oid.slice(0, 8)}\n  MAIN RED: ${names}${unread}\n  Fix main first; every open pull request is tested against it.`);
} else if (showAll || mainRunning.length || mainRollup?.state === 'PENDING') {
  const waiting = mainRunning.length > 0 || mainRollup?.state === 'PENDING';
  console.log(`${waiting ? 'WAIT ' : 'OK   '}${main.name} @ ${main.target.oid.slice(0, 8)}${waiting ? `\n  RUNNING: ${mainRunning.length || 'some'} checks${unread}` : ''}`);
}
for (const p of prs.nodes) {
  if (ignored.has(p.number)) { if (showAll) console.log(`SKIP #${p.number} ${p.headRefName} (parked)`); continue; }
  const reasons = [];
  const notes = [];
  if (p.mergeable === 'CONFLICTING') reasons.push('CONFLICT: no longer merges with main');
  else if (p.mergeable === 'UNKNOWN') notes.push('CHECKING: GitHub is still working out whether it merges');
  else if (p.mergeStateStatus === 'BEHIND') reasons.push('BEHIND: merge main into the branch (no rebase), then wait for the checks');
  const roll = p.commits.nodes[0]?.commit.statusCheckRollup;
  const ctx = roll?.contexts.nodes ?? [];
  const failed = ctx.filter((c) => BAD.has(c.conclusion ?? '') || BAD.has(c.state ?? '')).map((c) => c.name ?? c.context);
  const running = ctx.filter((c) => c.__typename === 'CheckRun' ? c.status !== 'COMPLETED' : c.state === 'PENDING');
  if (failed.length) reasons.push(`RED: ${failed.join(', ')}`);
  else if (running.length) notes.push(`RUNNING: ${running.length} checks`);
  else if (!roll) notes.push('no checks have reported on the head commit');
  const open = p.reviewThreads.nodes.filter((t) => !t.isResolved && !t.isOutdated && t.comments.nodes[0]?.isCopilotCodeReview);
  if (open.length) reasons.push(`FINDINGS: ${open.length} open Copilot thread${open.length > 1 ? 's' : ''}`);
  const tag = `#${p.number}${p.isDraft ? ' (draft)' : ''} ${p.headRefName}`;
  if (reasons.length) {
    needing++;
    console.log(`NEEDS ATTENTION ${tag}\n  ${[...reasons, ...notes].join('\n  ')}`);
  } else if (showAll || notes.length) {
    console.log(`${notes.length ? 'WAIT ' : 'OK   '}${tag}${notes.length ? `\n  ${notes.join('\n  ')}` : ''}`);
  }
}
console.log(needing ? `\n${needing} of ${prs.nodes.length} open pull requests need attention.` : `\nAll ${prs.nodes.length} open pull requests are clear or still running.`);
if (mainRed) console.log('main itself is RED.');
process.exit(needing || mainRed ? 1 : 0);
