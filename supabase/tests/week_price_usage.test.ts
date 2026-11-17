/**
 * Every price a week snapshot or a score stores goes through ONE rule,
 * ../functions/_shared/week-price.ts (2026-11-17). This reads the sources and
 * fails if a scoring-path function prices on its own again, or if anything in
 * the scoring path reads a quote's ask or bid directly.
 *
 *   deno test --allow-read supabase/tests/week_price_usage.test.ts
 */

import { assert, assertEquals } from 'jsr:@std/assert';

const FN = new URL('../functions/', import.meta.url);
const read = (p: string) => Deno.readTextFileSync(new URL(p, FN));

/** The functions whose prices become week_snapshots rows or scores. */
const SCORING_FUNCTIONS = ['snapshot-week-start', 'snapshot-week-end', 'process-week-results'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of Deno.readDirSync(new URL(`${dir}/`, FN))) {
    if (e.isFile && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(`${dir}/${e.name}`);
  }
  return out;
}

Deno.test('the three scoring functions price through _shared/week-price.ts', () => {
  for (const fn of SCORING_FUNCTIONS) {
    const src = read(`${fn}/index.ts`);
    assert(
      /import \{[^}]*\bfetchWeekPrices\b[^}]*\} from '\.\.\/_shared\/week-price\.ts'/.test(src),
      `${fn}/index.ts must import fetchWeekPrices from ../_shared/week-price.ts`,
    );
    assert(/await fetchWeekPrices\(/.test(src), `${fn}/index.ts must call fetchWeekPrices`);
  }
});

Deno.test('no scoring-path source reads Alpaca prices on its own or takes a quote side', () => {
  const offenders: string[] = [];
  for (const fn of SCORING_FUNCTIONS) {
    for (const f of sourceFiles(fn)) {
      const src = read(f);
      // Comments may NAME the old defect; code must not contain it.
      const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      if (/data\.alpaca\.markets/.test(code)) offenders.push(`${f}: calls Alpaca directly`);
      if (/quotes\/latest|trades\/latest|\/stocks\/bars/.test(code)) offenders.push(`${f}: own price endpoint`);
      if (/\.ap\b|\.bp\b|\['ap'\]|\['bp'\]/.test(code)) offenders.push(`${f}: reads a quote side`);
    }
  }
  assertEquals(offenders, []);
});

Deno.test('the shared rule never returns a one-sided quote as a price', () => {
  const src = read('_shared/week-price.ts');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  // The only place q.ap / q.bp are read is midpointPrice, and it returns their mean.
  assert(!/return\s*\{\s*price:\s*(ask|bid|Number\(q\.(ap|bp)\))\s*\}/.test(code), 'a side is returned as a price');
  assert(/const mid = \(bid \+ ask\) \/ 2;/.test(code));
});

Deno.test('the re-price branch returns BEFORE runJob, so it never writes cron_job_status', () => {
  const src = read('snapshot-week-start/index.ts');
  const reprice = src.indexOf("if (parsedBody.kind === 'reprice') return await handleReprice(");
  const runJob = src.indexOf('return await runJob<Response>(');
  const authGate = src.indexOf('if (!isAuthorized(req)) {');
  assert(authGate > 0 && reprice > authGate, 'the body is read only after the cron-key gate');
  assert(reprice > 0 && runJob > reprice, 'the re-price branch must return before runJob');
  const handler = src.slice(src.indexOf('async function handleReprice('), src.indexOf('Deno.serve('));
  assert(!/writeJobStatus|runJob|scheduleRetry/.test(handler), 'handleReprice must not touch job status or retries');
  assert(/live: null/.test(handler), 'the repair prices from the bar only');
});
