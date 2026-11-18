#!/usr/bin/env node
// "No new errors" check for the two areas that already had errors on main when
// CI was introduced (2026-11-17). Usage: node scripts/ci-ratchet.mjs <check>
//
//   web-lint        ESLint errors in apps/web        (needs `npm ci` at the root)
//   edge-typecheck  `deno check` errors across every supabase/functions/*/index.ts
//
// The allowed count for each lives in .github/ci-baselines.json. The check fails
// when the count goes UP (a new error) and also when it goes DOWN without the
// baseline being lowered, so the number can only ever shrink. Never raise a
// baseline to get a green run: fix the new error.
//
// A crashed tool is a failure, never "0 errors": the count is only trusted when
// the tool's own output could be read (see CLAUDE.md, "Success signals").
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, '.github', 'ci-baselines.json');
const run = (cmd, args, cwd) =>
  spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1' } });

const CHECKS = {
  'web-lint'() {
    const cwd = join(root, 'apps', 'web');
    const r = run('npx', ['--no-install', 'eslint', '.', '--format', 'json'], cwd);
    let files;
    try {
      files = JSON.parse(r.stdout);
    } catch {
      return { broken: `eslint did not return JSON (exit ${r.status}).\n${r.stdout}\n${r.stderr}` };
    }
    const lines = [];
    for (const f of files) {
      for (const m of f.messages) {
        if (m.severity === 2) lines.push(`${relative(root, f.filePath)}:${m.line}:${m.column}  ${m.ruleId ?? 'parse error'}  ${m.message}`);
      }
    }
    return { count: lines.length, lines };
  },
  'edge-typecheck'() {
    const dir = join(root, 'supabase', 'functions');
    const entries = readdirSync(dir)
      .map((name) => join('supabase', 'functions', name, 'index.ts'))
      .filter((p) => existsSync(join(root, p)))
      .sort();
    if (entries.length === 0) return { broken: 'no supabase/functions/*/index.ts found' };
    const r = run('deno', ['check', ...entries], root);
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    const blocks = out.split(/\n(?=TS\d+ \[ERROR\])/).filter((b) => /^TS\d+ \[ERROR\]/.test(b));
    const lines = blocks.map((b) => {
      const at = b.match(/at file:\/\/\S*?\/(supabase\/functions\/\S+)/);
      return `${at ? at[1] : '(unknown location)'}  ${b.split('\n')[0]}`;
    });
    // Exit 0 must mean zero errors, and a non-zero exit must come with errors we could read.
    if (r.status === null) return { broken: `deno could not be started: ${r.error?.message ?? 'unknown'}` };
    if ((r.status === 0) !== (lines.length === 0)) return { broken: `deno check exited ${r.status} but ${lines.length} errors were parsed.\n${out}` };
    return { count: lines.length, lines, note: `${entries.length} functions checked` };
  },
};

const name = process.argv[2];
if (!CHECKS[name]) {
  console.error(`usage: node scripts/ci-ratchet.mjs <${Object.keys(CHECKS).join('|')}>`);
  process.exit(2);
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))[name];
if (!Number.isInteger(baseline) || baseline < 0) {
  console.error(`${name}: no whole-number baseline in .github/ci-baselines.json`);
  process.exit(2);
}
const result = CHECKS[name]();
if (result.broken) {
  console.error(`${name}: the tool did not run cleanly, so this is a failure, not a pass.\n${result.broken}`);
  process.exit(2);
}
const { count, lines, note } = result;
console.log(`${name}: ${count} errors, baseline ${baseline}${note ? ` (${note})` : ''}`);
if (count > baseline) {
  console.error(`\nFAIL: ${count - baseline} more than the baseline. Every current error is listed; the new one is in a file this change touched.\n`);
  for (const l of lines) console.error(l);
  process.exit(1);
}
if (count < baseline) {
  console.error(`\nFAIL: errors went down, which is good. Lower "${name}" to ${count} in .github/ci-baselines.json in this same change so it cannot creep back.`);
  process.exit(1);
}
console.log('OK: no new errors.');
