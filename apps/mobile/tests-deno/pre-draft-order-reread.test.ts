/**
 * The stale pre-draft order (League B, build 1.3.0 (12), 2026-11-10): usePreDraftData read get_draft_order ONCE
 * (its effect keyed on [leagueId]), so a League tab opened before T-1h kept "Draft order · waiting" after the
 * server set the order (DraftLobby shows waiting whenever `data.waiting || !order`).
 *
 * The fix: the hook re-reads on a key, and both callers pass useDraftAutoStart's statusKey (the T-1h and T
 * boundaries, the poll from T, fixes, pull-to-refresh). The rules are pure (lib/home/preDraftRead.ts): a re-read
 * keeps the last answer while it loads and never blanks on a failure, and an order that is due but not set is
 * re-checked shortly. The wiring is read from the source.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  nextPreDraftData,
  ORDER_DUE_WINDOW_MS,
  ORDER_RECHECK_MAX,
  ORDER_RECHECK_MS,
  orderRecheckDelayMs,
  PRE_DRAFT_EMPTY,
} from '../lib/home/preDraftRead.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const NOW = '2026-11-10T17:00:00.000Z';
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();
/** get_draft_order's jsonb, as 20261013000000 returns it. */
const orderRpc = (o: { order?: string[] | null; state?: string; finalizeInMs?: number | null; waiting?: boolean }) => ({
  ok: true, mode: 'random', state: o.state ?? 'open',
  draft_date: o.finalizeInMs == null ? null : at(o.finalizeInMs + 3600_000),
  finalize_at: o.finalizeInMs == null ? null : at(o.finalizeInMs),
  revealed: !!o.order, order: o.order ? o.order.map((user_id, i) => ({ position: i + 1, user_id })) : null,
  finalized: o.state === 'finalized', locked: false, num_rounds: 6, member_count: 4, min_members: 4,
  waiting_for_members: o.waiting ?? false, is_commissioner: false, can_edit_order: false, can_change_mode: false,
  server_now: NOW,
});
const names = [
  { user_id: 'me', display_name: 'Roberto B.', is_bot: false },
  { user_id: 'paolo', display_name: 'Paolo M.', is_bot: false },
];
const ok = (data: unknown) => ({ data, error: null });
const failed = { data: null, error: { message: 'Failed to fetch' } };
const SET = ['paolo', 'me', 'luca', 'chiara'];

// ── rule 1: the first read, and re-reads that keep what is shown ──

Deno.test('the first read lands: loading ends, waiting before T-1h (no order)', () => {
  const d = nextPreDraftData(null, ok(orderRpc({ finalizeInMs: 3600_000 })), ok(names));
  assertEquals(d.loading, false);
  assertEquals(d.orderRevealed, null);
  assertEquals(d.waiting, false);
  assertEquals(d.members.map((m) => m.userId), ['me', 'paolo']);
  assertEquals(PRE_DRAFT_EMPTY.loading, true, 'loading is the state before the first read only');
});

Deno.test('the re-read after T-1h replaces "waiting" with the set order (the League B bug)', () => {
  const before = nextPreDraftData(null, ok(orderRpc({ finalizeInMs: 10_000 })), ok(names));
  const after = nextPreDraftData(before, ok(orderRpc({ order: SET, state: 'finalized', finalizeInMs: -500 })), ok(names));
  assertEquals(after.orderRevealed, SET);
  assertEquals(after.loading, false);
});

Deno.test('a FAILED re-read keeps the shown order and members (never blanks)', () => {
  const shown = nextPreDraftData(null, ok(orderRpc({ order: SET, state: 'finalized', finalizeInMs: -60_000 })), ok(names));
  const blip = nextPreDraftData(shown, failed, failed);
  assertEquals(blip, shown, 'byte-identical: nothing blanked, still not loading');
  const half = nextPreDraftData(shown, failed, ok([names[0]]));
  assertEquals(half.orderRevealed, SET, 'the order read failed: its answer is kept');
  assertEquals(half.members.map((m) => m.userId), ['me'], 'the names read answered: it replaces');
  const otherHalf = nextPreDraftData(shown, ok(orderRpc({ order: SET.slice().reverse(), state: 'finalized', finalizeInMs: -60_000 })), failed);
  assertEquals(otherHalf.members, shown.members, 'the names read failed: its answer is kept');
  assertEquals(otherHalf.orderRevealed, SET.slice().reverse());
});

Deno.test('a failed FIRST read shows the not-revealed state, as before (no guessed order)', () => {
  const d = nextPreDraftData(null, failed, failed);
  assertEquals([d.loading, d.orderRevealed, d.waiting, d.members], [false, null, null, []]);
});

Deno.test('a re-read the server ANSWERS with a refusal replaces the order (an answer is not a failure)', () => {
  const shown = nextPreDraftData(null, ok(orderRpc({ order: SET, state: 'finalized', finalizeInMs: -60_000 })), ok(names));
  const refused = nextPreDraftData(shown, ok({ ok: false, reason: 'not_a_member' }), ok(names));
  assertEquals(refused.orderRevealed, null);
});

// ── rule 2: due but not set, re-check soon (the next boundary is an hour away) ──

Deno.test('due on the server but not set yet (gate not cleared, or the boundary read landed early): re-check', () => {
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: -2000 })), 0), ORDER_RECHECK_MS, 'already due');
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: 800 })), 0), 800 + ORDER_RECHECK_MS, 'the T-1h read landed 0.8 s early');
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: ORDER_DUE_WINDOW_MS })), 0), ORDER_DUE_WINDOW_MS + ORDER_RECHECK_MS);
});

Deno.test('no re-check when there is nothing to wait for, or the budget is spent', () => {
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: 3600_000 })), 0), null, 'an hour out: the boundary re-read covers it');
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ order: SET, state: 'finalized', finalizeInMs: -1 })), 0), null, 'set');
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: -1, waiting: true })), 0), null, 'below four: a join sets it');
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: null })), 0), null, 'no draft time (a postponement clears it)');
  assertEquals(orderRecheckDelayMs(failed, 0), null, 'a failed read: the next key re-reads');
  assertEquals(orderRecheckDelayMs(ok({ ok: false, reason: 'not_a_member' }), 0), null);
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: -1 })), ORDER_RECHECK_MAX), null, 'bounded');
  assertEquals(orderRecheckDelayMs(ok(orderRpc({ finalizeInMs: -1 })), ORDER_RECHECK_MAX - 1), ORDER_RECHECK_MS);
});

// ── the wiring ──

const HOOK = SOURCES['lib/home/usePreDraftData.ts'];
const AUTO = SOURCES['lib/game/useDraftAutoStart.ts'];
const LEAGUE = SOURCES['app/(tabs)/league.tsx'];
const CARD = SOURCES['components/home/PreDraftCard.tsx'];
const HOME = SOURCES['app/(tabs)/index.tsx'];
/** The source with comments removed, so a commented-out line never passes a guard. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

Deno.test('the hook takes a key and re-reads on it (the read effect depends on it)', () => {
  const h = code(HOOK);
  assert(h.includes('export function usePreDraftData(leagueId: string, refreshKey: number): PreDraftData {'));
  assert(h.includes('}, [leagueId, refreshKey, recheck]);'), 'the read effect re-runs on the key and on a re-check');
  assert(h.includes('}, [leagueId, refreshKey]);'), 'a new key starts a new re-check budget');
  assertEquals((h.match(/\[leagueId\]\)/g) ?? []).length, 0, 'no effect keyed on the league alone (the stale read)');
});

Deno.test('the hook folds through the pure rules and never resets what is shown on a re-read', () => {
  const h = code(HOOK);
  assert(h.includes('nextPreDraftData(s?.leagueId === leagueId ? s.data : null, order, names)'), 'the previous answer is the fold input');
  assert(h.includes('const delay = orderRecheckDelayMs(order, attempts.current);'));
  assert(h.includes('return state?.leagueId === leagueId ? state.data : PRE_DRAFT_EMPTY;'), 'loading only before this league\'s first read');
  assertEquals((h.match(/setState\(/g) ?? []).length, 3, 'two fixtures and the fold; no blanking setState');
  assert(!/setState\(\s*(null|PRE_DRAFT_EMPTY)/.test(h));
  assert(!h.includes('{ data: orderRaw }'), 'the resolved { error } is read, never dropped');
});

Deno.test('useDraftAutoStart hands out its status re-read counter', () => {
  assert(code(AUTO).includes('    statusKey,\n'), 'returned');
  assert(AUTO.includes('const [statusKey, setStatusKey] = useState(0);'));
  assert(AUTO.includes('const ds = useDraftStatus(leagueId, true, statusKey);'), 'the same counter keys the status read');
});

Deno.test('BOTH callers pass the status key (the League lobby and Home\'s PreDraftCard)', () => {
  for (const [name, src] of [['league.tsx', LEAGUE], ['PreDraftCard.tsx', CARD]] as const) {
    const c = code(src);
    assertEquals((c.match(/usePreDraftData\(/g) ?? []).length, 1, name);
    assert(c.includes('usePreDraftData(leagueId, auto.statusKey)'), `${name} keys the order on the status`);
    assert(c.indexOf('useDraftAutoStart(leagueId') < c.indexOf('usePreDraftData(leagueId'), `${name}: the key exists before the read`);
  }
});

Deno.test('pull-to-refresh re-reads it: League through auto.reread, Home through pullKey', () => {
  const lg = code(LEAGUE);
  const lobby = lg.slice(lg.indexOf('function LeagueLobby('));
  assert(/onRefresh=\{async \(\) => \{\s*auto\.reread\(\);\s*await refresh\(\);/.test(lobby), 'League: the pull bumps the status key');
  const home = code(HOME);
  assert(home.includes('<BarsRefresh onRefresh={onPull}'), 'Home\'s pull goes through onPull');
  assert(/const onPull = useCallback\(async \(\) => \{\s*setPullKey\(\(k\) => k \+ 1\);\s*await refresh\(\);/.test(home));
  assert(home.includes('skipEntrance={skipEntrance} pullKey={pullKey} />'), 'HomeBody gets it');
  assert(/numParticipants: league\.num_participants,\s*pullKey,\s*\};/.test(home), 'both PreDraftCard paths (preDraft props)');
  const card = code(CARD);
  assert(/useEffect\(\(\) => \{\s*if \(pullKey > 0\) reread\(\);\s*\}, \[pullKey, reread\]\);/.test(card), 'the card re-reads on a pull');
});
