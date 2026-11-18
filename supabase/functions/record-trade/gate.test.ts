/**
 * Hermetic tests for record-trade/gate.ts. Run:
 *   deno test supabase/functions/record-trade/gate.test.ts
 * The SQL twin (record_trade_atomic, 20261207000000) and the parity between the
 * two run in supabase/tests/record_trade_season_end.pglite.test.ts.
 */
import { assertEquals } from 'jsr:@std/assert';
import { seasonEndFromMatchups, type SeasonMatchupRow, tradeRefusalReason } from './gate.ts';

const NOW = new Date('2026-12-18T22:00:00.000Z');
const open = { draft_status: 'completed', season_status: 'active' };

Deno.test('tradeRefusalReason: an open season with a completed draft may trade', () => {
  assertEquals(tradeRefusalReason({ draft_status: 'completed', season_status: 'active' }, null, NOW), null);
  assertEquals(tradeRefusalReason({ draft_status: 'completed', season_status: 'playoffs' }, null, NOW), null);
});

Deno.test('tradeRefusalReason: a draft that has not completed refuses (unchanged)', () => {
  assertEquals(tradeRefusalReason({ draft_status: 'in_progress', season_status: 'active' }, null, NOW), 'draft_not_completed');
  assertEquals(tradeRefusalReason({ draft_status: 'not_started', season_status: 'active' }, null, NOW), 'draft_not_completed');
  // The draft check comes first, even past the season end.
  assertEquals(
    tradeRefusalReason({ draft_status: 'in_progress', season_status: 'active' }, new Date('2026-01-01T00:00:00Z'), NOW),
    'draft_not_completed',
  );
});

Deno.test('tradeRefusalReason: a completed season refuses, even with a completed draft (unchanged)', () => {
  assertEquals(tradeRefusalReason({ draft_status: 'completed', season_status: 'completed' }, null, NOW), 'season_completed');
  // ...and even when the season end is still ahead.
  assertEquals(
    tradeRefusalReason({ draft_status: 'completed', season_status: 'completed' }, new Date('2027-01-01T00:00:00Z'), NOW),
    'season_completed',
  );
});

Deno.test('tradeRefusalReason: a null season_status is not treated as completed', () => {
  assertEquals(tradeRefusalReason({ draft_status: 'completed', season_status: null }, null, NOW), null);
});

Deno.test('tradeRefusalReason: past the season end BY DATE refuses before the flag is set', () => {
  assertEquals(tradeRefusalReason(open, new Date('2026-12-18T21:00:00.000Z'), NOW), 'season_completed');
  assertEquals(tradeRefusalReason({ ...open, season_status: 'playoffs' }, new Date('2026-12-18T21:00:00.000Z'), NOW), 'season_completed');
});

Deno.test('tradeRefusalReason: the boundary is STRICT (a trade AT week_end is still in the final window)', () => {
  assertEquals(tradeRefusalReason(open, NOW, NOW), null);
  assertEquals(tradeRefusalReason(open, new Date(NOW.getTime() - 1), NOW), 'season_completed');
  assertEquals(tradeRefusalReason(open, new Date(NOW.getTime() + 1), NOW), null);
});

Deno.test('tradeRefusalReason: no season end (null) is no date check -- the flag alone decides', () => {
  assertEquals(tradeRefusalReason(open, null, NOW), null);
});

// ---- seasonEndFromMatchups -----------------------------------------------------

const reg = (week_end: string | null): SeasonMatchupRow => ({ week_end, is_playoff: false });
const po = (week_end: string | null): SeasonMatchupRow => ({ week_end, is_playoff: true });

Deno.test('seasonEndFromMatchups: no matchups at all (a Duration league) -> null, today\'s behaviour', () => {
  assertEquals(seasonEndFromMatchups([]), null);
});

Deno.test('seasonEndFromMatchups: no playoff row (regular season / transition not run) -> null, never the regular end', () => {
  assertEquals(seasonEndFromMatchups([reg('2026-11-20T21:00:00Z'), reg('2026-11-27T21:00:00Z')]), null);
  // is_playoff NULL (the column is nullable, DEFAULT false) is a regular week.
  assertEquals(seasonEndFromMatchups([{ week_end: '2026-11-27T21:00:00Z', is_playoff: null }]), null);
});

Deno.test('seasonEndFromMatchups: with the bracket written -> the latest week_end (the final\'s)', () => {
  const rows = [reg('2026-11-20T21:00:00Z'), po('2026-12-04T21:00:00Z'), po('2026-12-11T21:00:00Z'), reg('2026-11-27T21:00:00Z')];
  assertEquals(seasonEndFromMatchups(rows), new Date('2026-12-11T21:00:00Z'));
});

Deno.test('seasonEndFromMatchups: the max is over ALL matchups, not only playoff rows', () => {
  assertEquals(seasonEndFromMatchups([po('2026-12-11T21:00:00Z'), reg('2026-12-12T21:00:00Z')]), new Date('2026-12-12T21:00:00Z'));
});

Deno.test('seasonEndFromMatchups: a NULL or unparseable week_end anywhere -> null (no verdict from a subset)', () => {
  assertEquals(seasonEndFromMatchups([reg('2026-11-20T21:00:00Z'), po(null), po('2026-12-11T21:00:00Z')]), null);
  assertEquals(seasonEndFromMatchups([reg(null), po('2026-12-11T21:00:00Z')]), null);
  assertEquals(seasonEndFromMatchups([po('not a date'), po('2026-12-11T21:00:00Z')]), null);
});

Deno.test('seasonEndFromMatchups + tradeRefusalReason: the gap this closes, end to end', () => {
  const rows = [reg('2026-11-27T21:00:00Z'), po('2026-12-04T21:00:00Z'), po('2026-12-11T20:00:00Z')];
  // Monday after the final, completion not yet healed: refused.
  assertEquals(tradeRefusalReason({ ...open, season_status: 'playoffs' }, seasonEndFromMatchups(rows), new Date('2026-12-14T14:31:00Z')), 'season_completed');
  // During the final week: allowed.
  assertEquals(tradeRefusalReason({ ...open, season_status: 'playoffs' }, seasonEndFromMatchups(rows), new Date('2026-12-09T15:00:00Z')), null);
});
