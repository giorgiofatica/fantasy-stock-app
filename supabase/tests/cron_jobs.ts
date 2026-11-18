/**
 * Pure helpers over supabase/migrations/: which cron jobs are still scheduled after
 * every migration, and with what command. Shared by cron_timeouts.pglite.test.ts
 * (the timeout guard) and step5_final_attempts.test.ts (where each snapshot job's
 * attempt number comes from). No Deno.test here, so importing it registers nothing.
 */

const ROOT = new URL('../../', import.meta.url);
export const MIGRATIONS_DIR = new URL('supabase/migrations/', ROOT);
const mig = (name: string) => Deno.readTextFile(new URL(name, MIGRATIONS_DIR));

export interface ScheduledJob { name: string; schedule: string; command: string; file: string }

/**
 * Replay cron.schedule / cron.unschedule over migration files in order. A job whose
 * LAST event is an unschedule (sync-alpaca-orders) is gone and ignored. Only literal
 * names are tracked; names built at runtime (the retry jobs) are covered by the
 * function-body check instead.
 */
export function scheduledJobs(files: Array<{ name: string; sql: string }>): ScheduledJob[] {
  const live = new Map<string, ScheduledJob>();
  const ev = /cron\.(un)?schedule\(\s*'([^']+)'(?:\s*,\s*'([^']+)'\s*,\s*\$(\w*)\$([\s\S]*?)\$\4\$)?/dgi;
  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    // Blank comment lines IN PLACE (same length) so a commented-out schedule is not
    // seen, while match offsets still index the original text, whose command keeps
    // its inline comments (the live row stores them verbatim).
    const blanked = f.sql.replace(/^[ \t]*--.*$/gm, (c) => ' '.repeat(c.length));
    for (const m of blanked.matchAll(ev)) {
      const [, un, name, schedule] = m;
      if (un) live.delete(name);
      else if (schedule !== undefined) {
        const [a, b] = m.indices![5]!;
        live.set(name, { name, schedule, command: f.sql.slice(a, b), file: f.name });
      }
    }
  }
  return [...live.values()];
}

export async function migrationFiles() {
  const out: Array<{ name: string; sql: string }> = [];
  // readDir is NOT recursive: deferred/ is never read, as `supabase db push` ignores it.
  // A deferred cron joins the guard the moment it is promoted into migrations/.
  for await (const e of Deno.readDir(MIGRATIONS_DIR)) {
    if (e.isFile && e.name.endsWith('.sql')) out.push({ name: e.name, sql: await mig(e.name) });
  }
  return out;
}
