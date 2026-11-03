/**
 * Home's "Your season" strip (Design Lead build spec, 2026-11-03; PRODUCT_RULES "No chart on
 * Home"): the tiles (lib/home/yourSeason), the opening offset, the taps and the VoiceOver
 * strings, plus source guards for the wiring Deno can't render. Mutants at hand-back.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import {
  anchorIndex, buildSeasonTiles, initialOffset, seasonStripShown, thisWeekNumber, tileHint, tileLabel, tileTargetsMatchup, tileWidth,
  tileMinHeight, ROW_LEAD, TILE_GAP, PEEK, type SeasonMatchupRow, type SeasonTile, type SeasonWeeklyResult,
} from '../lib/home/yourSeason.ts';
import type { PhaseResult } from '../lib/home/homePhase.ts';
import { SCHEDULE_HREF, THIS_WEEK_HREF, leagueSegmentFromParam, STANDINGS_HREF } from '../lib/home/calmHome.ts';

const ME = 'me';
const names: Record<string, string> = { paolo: 'Paolo M.', luca: 'Luca V.', gia: 'Gianluigi B.' };
const nameOf = (id: string) => names[id] ?? 'Opponent';

const row = (week: number, opp: string | null, mine: number | null, theirs: number | null, playoff = false): SeasonMatchupRow => ({
  week_number: week, is_playoff: playoff, team1_user_id: ME, team2_user_id: opp, team1_gain: mine, team2_gain: theirs,
});
const res = (week: number, result: SeasonWeeklyResult['result'], gain = 10): SeasonWeeklyResult => ({ week, gain, result });
const base = { numWeeks: 14 as number | null };
const live: PhaseResult = { kind: 'live_open', week: 6, isPlayoff: false, round: null, weekEnd: '', ...base };

/** Weeks 1-5 played (W, W, L, W, W), then the caller's rows. */
const played5 = [row(1, 'paolo', 41, 5), row(2, 'luca', 58, 1), row(3, 'gia', -96, 3), row(4, 'paolo', 72, 5), row(5, 'luca', 54, 2)];
const results5: SeasonWeeklyResult[] = [res(1, 'W', 41), res(2, 'W', 58), res(3, 'L', -96), res(4, 'W', 72), res(5, 'W', 54)];

function tiles(phase: PhaseResult, rows: SeasonMatchupRow[], results: SeasonWeeklyResult[], currentWeek: number) {
  return buildSeasonTiles({ myUserId: ME, phase, currentWeek, matchups: rows, weeklyResults: results, nameOf });
}

// ── Where it shows ──────────────────────────────────────────────────────────
Deno.test('the strip shows in season only: not in pre_draft, drafting, pre_season or complete', () => {
  for (const k of ['pre_draft', 'drafting', 'pre_season', 'complete'] as const) assertEquals(seasonStripShown(k), false, k);
  for (const k of ['live_open', 'live_closed', 'scoring', 'scored', 'bye', 'playoff_bye', 'playoff_pending', 'eliminated', 'missed_playoffs'] as const) {
    assertEquals(seasonStripShown(k), true, k);
  }
});

// ── Tiles by state ──────────────────────────────────────────────────────────
Deno.test('live_open: played weeks, this week live with "Live", the weeks ahead name the opponent', () => {
  const t = tiles(live, [...played5, row(6, 'gia', null, null), row(7, 'paolo', null, null), row(8, 'luca', null, null)], results5, 6);
  assertEquals(t.map((x) => x.kind), ['played', 'played', 'played', 'played', 'played', 'this', 'upcoming', 'upcoming']);
  const me = t[5];
  assert(me.kind === 'this' && me.middle === 'live' && me.showLive && me.result === null);
  assertEquals(t[6].kind === 'upcoming' && t[6].opponent, 'Paolo M.');
  const third = t[2];
  assert(third.kind === 'played' && third.result === 'L' && third.gain === -96);
});

Deno.test('live_closed and scoring: a hollow ring, no label; the market-closed week is still this week', () => {
  const closed: PhaseResult = { kind: 'live_closed', week: 6, isPlayoff: false, round: null, reason: 'after_hours', resumesAt: null, weekEnd: '', lastCloseAt: null, ...base };
  const scoring: PhaseResult = { kind: 'scoring', week: 6, isPlayoff: false, round: null, weekEnd: '', ...base };
  for (const phase of [closed, scoring]) {
    const me = tiles(phase, [...played5, row(6, 'gia', null, null)], results5, 6)[5];
    assert(me.kind === 'this' && me.middle === 'ring' && !me.showLive && me.result === null, phase.kind);
  }
});

Deno.test('scored: the result letter, no score, no "Live"; a tie is a T (the one result list decides)', () => {
  const scored: PhaseResult = { kind: 'scored', week: 6, won: false, isPlayoff: false, round: null, nextStart: null, ...base };
  for (const r of ['W', 'L', 'T'] as const) {
    const me = tiles(scored, [...played5, row(6, 'gia', 5, 5)], [...results5, res(6, r)], 6)[5];
    assert(me.kind === 'this' && me.middle === 'result' && me.result === r && !me.showLive, r);
    assert(!('gain' in me), 'this week never carries a score');
  }
});

Deno.test('this week is never a score in ANY state', () => {
  const states: PhaseResult[] = [
    live,
    { kind: 'scoring', week: 6, isPlayoff: false, round: null, weekEnd: '', ...base },
    { kind: 'scored', week: 6, won: true, isPlayoff: false, round: null, nextStart: null, ...base },
    { kind: 'bye', week: 6, nextStart: null, ...base },
  ];
  for (const phase of states) {
    const me = tiles(phase, [...played5, row(6, phase.kind === 'bye' ? null : 'gia', 99, 3)], [...results5, res(6, phase.kind === 'bye' ? 'BYE' : 'W', 99)], 6)[5];
    assertEquals(me.kind, 'this', phase.kind);
    assertEquals('gain' in me, false, phase.kind);
  }
});

Deno.test('a bye this week and a past bye: "Bye" in text2, no score', () => {
  const bye: PhaseResult = { kind: 'bye', week: 6, nextStart: null, ...base };
  const t = tiles(bye, [row(1, 'paolo', 41, 5), row(2, null, null, null), row(3, 'luca', 5, 1), row(4, 'gia', 5, 1), row(5, 'luca', 5, 1), row(6, null, null, null), row(7, 'paolo', null, null)],
    [res(1, 'W'), res(2, 'BYE', 0), res(3, 'W'), res(4, 'W'), res(5, 'W'), res(6, 'BYE', 0)], 6);
  assertEquals(t[1].kind, 'bye');
  const me = t[5];
  assert(me.kind === 'this' && me.middle === 'bye' && !me.showLive);
});

Deno.test('a past week with an opponent and NO gain yet is a dash ("not scored yet"), never a W, an L or a Bye', () => {
  const t = tiles(live, [...played5.slice(0, 2), row(3, 'gia', null, null), row(4, 'paolo', 72, 5), row(5, 'luca', 54, null), row(6, 'gia', null, null)],
    [res(1, 'W'), res(2, 'W'), res(4, 'W')], 6);
  assertEquals(t[2].kind, 'unscored');
  assertEquals(t[4].kind, 'unscored'); // my gain posted, theirs not: not decided either
  assertEquals(tileLabel(t[2]), 'Week 3, not scored yet');
});

Deno.test('a week with no row for me is not drawn: a future playoff week with no named opponent, and weeks after elimination', () => {
  const t = tiles(live, [...played5, row(6, 'gia', null, null), row(7, null, null, null, true), row(8, 'paolo', null, null)], results5, 6);
  assertEquals(t.map((x) => x.week), [1, 2, 3, 4, 5, 6, 8]);
  // No row at all for week 7: not drawn either.
  assertEquals(tiles(live, [...played5, row(6, 'gia', null, null)], results5, 6).map((x) => x.week), [1, 2, 3, 4, 5, 6]);
});

Deno.test('a future regular-season bye is drawn as a bye tile (the schedule already knows it)', () => {
  const t = tiles(live, [...played5, row(6, 'gia', null, null), row(7, null, null, null), row(8, 'paolo', null, null)], results5, 6);
  assertEquals(t.map((x) => x.kind), ['played', 'played', 'played', 'played', 'played', 'this', 'bye', 'upcoming']);
});

Deno.test('playoffs: pending is a ring (its opponent is not named yet); the playoff bye is the current week, outlined', () => {
  const pending: PhaseResult = { kind: 'playoff_pending', week: 8, round: 'Semifinals', previousRound: 'Wild Card', ...base };
  const t = tiles(pending, [...played5, row(6, 'gia', 9, 1), row(7, 'paolo', 40, -10, true), row(8, null, null, null, true)], [...results5, res(6, 'W', 9), res(7, 'W', 40)], 8);
  assertEquals(t.map((x) => x.week), [1, 2, 3, 4, 5, 6, 7, 8]);
  const me = t[7];
  assert(me.kind === 'this' && me.middle === 'ring' && !me.showLive);
  assertEquals(t[6].kind, 'played'); // a scored playoff week is "Wk 7" like any other

  // The bye: homePhase names the LATER round's week; the tile is the league's current week.
  const bye: PhaseResult = { kind: 'playoff_bye', week: 8, round: 'Semifinals', ...base };
  assertEquals(thisWeekNumber(bye, 7), 7);
  const b = tiles(bye, [...played5, row(6, 'gia', 9, 1), row(8, null, null, null, true)], [...results5, res(6, 'W', 9)], 7);
  assertEquals(b.map((x) => x.week), [1, 2, 3, 4, 5, 6, 7]); // the later round is not drawn until it has an opponent
  const sit = b[6];
  assert(sit.kind === 'this' && sit.middle === 'bye');
});

Deno.test('eliminated and missed playoffs: no this-week tile, nothing after', () => {
  const eliminated: PhaseResult = { kind: 'eliminated', round: 'Wild Card', ...base };
  const t = tiles(eliminated, [...played5, row(6, 'gia', 9, 1), row(7, 'paolo', -10, 40, true)], [...results5, res(6, 'W', 9), res(7, 'L', -10)], 8);
  assertEquals(t.some((x) => x.kind === 'this'), false);
  assertEquals(t.map((x) => x.week), [1, 2, 3, 4, 5, 6, 7]);
  assert(t[6].kind === 'played' && t[6].result === 'L');
  const missed: PhaseResult = { kind: 'missed_playoffs', ...base };
  const m = tiles(missed, [...played5, row(6, 'gia', 9, 1)], [...results5, res(6, 'W', 9)], 8);
  assertEquals(m.some((x) => x.kind === 'this'), false);
  assertEquals(m.length, 6);
});

Deno.test('no rows (a failed or empty schedule read): no tiles at all', () => {
  assertEquals(tiles(live, [], [], 6), []);
});

Deno.test('rows that are not mine are ignored', () => {
  const other: SeasonMatchupRow = { week_number: 6, is_playoff: false, team1_user_id: 'paolo', team2_user_id: 'luca', team1_gain: null, team2_gain: null };
  assertEquals(tiles(live, [other], [], 6), []);
});

// ── Where the row opens ─────────────────────────────────────────────────────
Deno.test('the row opens at 0 while it fits (weeks 1-6 at Large on a 402pt screen), the next tile peeking', () => {
  for (let n = 1; n <= 6; n++) assertEquals(initialOffset({ tileCount: 8, anchorIndex: n - 1, fontScale: 1, viewportWidth: 402 }), 0, `week ${n}`);
});

Deno.test('week 11 opens with this week at the right edge and the next tile peeking', () => {
  const vw = 402;
  const offset = initialOffset({ tileCount: 14, anchorIndex: 10, fontScale: 1, viewportWidth: vw });
  assert(offset > 0);
  const w = tileWidth(1);
  const thisRight = ROW_LEAD + 11 * w + 10 * TILE_GAP - offset;
  assert(thisRight <= vw, 'this week is fully in view');
  const nextLeft = ROW_LEAD + 11 * w + 11 * TILE_GAP - offset;
  assert(nextLeft < vw && vw - nextLeft >= PEEK - 0.001, 'the next tile peeks');
});

Deno.test('the offset never passes the content, and the last tile has no peek to leave room for', () => {
  const contentWidth = ROW_LEAD + 14 * tileWidth(1) + 13 * TILE_GAP + ROW_LEAD;
  assert(initialOffset({ tileCount: 14, anchorIndex: 13, fontScale: 1, viewportWidth: 402 }) <= contentWidth - 402 + 0.001);
  assertEquals(initialOffset({ tileCount: 0, anchorIndex: -1, fontScale: 1, viewportWidth: 402 }), 0);
});

Deno.test('the anchor is this week, else the last drawn tile', () => {
  const t: SeasonTile[] = [{ kind: 'played', week: 1, result: 'W', gain: 1 }, { kind: 'this', week: 2, middle: 'live', result: null, reason: 'live', showLive: true }, { kind: 'upcoming', week: 3, opponent: 'X' }];
  assertEquals(anchorIndex(t), 1);
  assertEquals(anchorIndex([t[0], { kind: 'played', week: 2, result: 'L', gain: -1 }]), 1);
});

Deno.test('tile size: 54 x 76 at Large; width and height scale with text size up to 2.1x, no further', () => {
  assertEquals([tileWidth(1), tileMinHeight(1)], [54, 76]);
  assertEquals(tileWidth(2), 108);
  assertEquals(tileWidth(3.1), 54 * 2.1);
  assertEquals(tileWidth(3.1), tileWidth(5));
  assertEquals(tileMinHeight(3.1), 76 * 2.1);
  assertEquals(tileWidth(0.8), 54); // never smaller than Large
  assert(tileWidth(NaN) === 54);
});

// ── Taps ────────────────────────────────────────────────────────────────────
Deno.test('the title opens League on Schedule; this week opens Matchup; every other tile opens Schedule', () => {
  assertEquals(SCHEDULE_HREF, { pathname: '/(tabs)/league', params: { segment: 'schedule' } });
  assertEquals(leagueSegmentFromParam(SCHEDULE_HREF.params.segment), 'schedule', 'League accepts the segment');
  assertEquals(THIS_WEEK_HREF, '/(tabs)/matchup');
  assertEquals(STANDINGS_HREF.params.segment, 'standings'); // Standings is untouched
  const kinds: SeasonTile[] = [
    { kind: 'played', week: 1, result: 'W', gain: 1 }, { kind: 'unscored', week: 2 }, { kind: 'bye', week: 3 }, { kind: 'upcoming', week: 4, opponent: 'X' },
  ];
  for (const k of kinds) assertEquals(tileTargetsMatchup(k), false, k.kind);
  assertEquals(tileTargetsMatchup({ kind: 'this', week: 5, middle: 'live', result: null, reason: 'live', showLive: true }), true);
  assertEquals(tileHint({ kind: 'this', week: 5, middle: 'live', result: null, reason: 'live', showLive: true }), "Opens this week's matchup");
  assertEquals(tileHint(kinds[0]), 'Opens League schedule');
  const src = SOURCES['components/home/YourSeason.tsx'];
  assert(src.includes('onPress={() => router.push(tileTargetsMatchup(tile) ? THIS_WEEK_HREF : SCHEDULE_HREF)}'));
  assert(src.includes('onPress={() => router.push(SCHEDULE_HREF)}'));
});

// ── VoiceOver ───────────────────────────────────────────────────────────────
Deno.test('tile labels read their content: week, result and score, bye, this week, opponent, not scored', () => {
  assertEquals(tileLabel({ kind: 'played', week: 3, result: 'L', gain: -96.4 }), 'Week 3, lost, −$96.40');
  assertEquals(tileLabel({ kind: 'played', week: 4, result: 'W', gain: 72.1 }), 'Week 4, won, +$72.10');
  assertEquals(tileLabel({ kind: 'played', week: 2, result: 'T', gain: 0 }), 'Week 2, tied, $0.00');
  assertEquals(tileLabel({ kind: 'bye', week: 5 }), 'Week 5, bye');
  assertEquals(tileLabel({ kind: 'this', week: 6, middle: 'live', result: null, reason: 'live', showLive: true }), 'Week 6, this week, live');
  assertEquals(tileLabel({ kind: 'this', week: 6, middle: 'ring', result: null, reason: 'closed', showLive: false }), 'Week 6, this week, market closed');
  assertEquals(tileLabel({ kind: 'this', week: 6, middle: 'result', result: 'W', reason: 'scored', showLive: false }), 'Week 6, this week, won');
  assertEquals(tileLabel({ kind: 'this', week: 6, middle: 'bye', result: null, reason: 'bye', showLive: false }), 'Week 6, this week, bye');
  assertEquals(tileLabel({ kind: 'upcoming', week: 7, opponent: 'Paolo M.' }), 'Week 7, against Paolo M.');
  assertEquals(tileLabel({ kind: 'unscored', week: 3 }), 'Week 3, not scored yet');
});

// ── The wiring ──────────────────────────────────────────────────────────────
Deno.test('the component: keyed by the font scale, a header + button title, a one-line fitted score, the glyph capped at 2.0x', () => {
  const src = SOURCES['components/home/YourSeason.tsx'];
  assert(src.includes('<View key={fontScaleKey(fontScale)} style={styles.root} testID="your-season">'));
  assert(src.includes('accessibilityLabel={YOUR_SEASON_TITLE}') && src.includes('accessibilityHint={OPENS_SCHEDULE_HINT}'));
  assert(src.includes('<View accessibilityRole="header">'));
  assert(src.includes('numberOfLines={1}\n          adjustsFontSizeToFit\n          minimumFontScale={SCORE_MIN_FONT_SCALE}'));
  assert(src.includes('maxFontSizeMultiplier={GLYPH_MAX_SCALE}'));
  assert(src.includes('keepMoney(formatMoney(tile.gain, { sign: \'always\' }))'));
  assert(src.includes('contentOffset={{ x: offset, y: 0 }}'));
  assert(src.includes('showsHorizontalScrollIndicator={false}'));
  assert(!src.includes('pagingEnabled') && !src.includes('snapTo'));
  // Never persisted.
  assert(!src.includes('AsyncStorage') && !src.includes('SecureStore'));
  // Min 44pt targets.
  assert(src.includes('minHeight: 44,'));
});

Deno.test('the entrance is the Standings card\'s: staggered FadeInDown, none when Reduce Motion or on a league switch', () => {
  const src = SOURCES['components/home/YourSeason.tsx'];
  assert(src.includes('const entering = reduced || skipEntrance'));
  assert(src.includes('FadeInDown.delay(stagger.delayFor(i))'));
});

Deno.test('the surfaces: played on surface + the card rim, this week on youTint + a 1.5pt you outline, ahead: no fill, a 1pt line', () => {
  const src = SOURCES['components/home/YourSeason.tsx'];
  assert(src.includes('const fill = isThis ? colors.youTint : upcoming ? undefined : colors.surface;'));
  assert(src.includes("isThis ? { width: 1.5, color: colors.you } : upcoming ? { width: 1, color: colors.line } : { width: RIM_WIDTH, color: colors.rim }"));
  // The ring is the neutral text2, never the live colour (live means live, §9C).
  assert(src.includes("borderWidth: 1.5, borderColor: colors.text2 }} />"));
  // "Live" only in live_open.
  assert(src.includes('if (tile.showLive) bottom ='));
});

Deno.test('the Home screen feeds the strip from the view model\'s tiles, and nothing derives W/L from two gains', () => {
  const home = SOURCES['app/(tabs)/index.tsx'];
  assert(home.includes('<YourSeason tiles={seasonTiles} skipEntrance={skipEntrance} />'));
  assert(!home.includes('resultFromGains'));
  const strip = SOURCES['components/home/YourSeason.tsx'];
  assert(!/>\s*[a-zA-Z.]*[gG]ain\s*[<>]/.test(strip.replace(/formatMoney\([^)]*\)/g, '')), 'no gain-vs-gain comparison in the component');
  const pure = SOURCES['lib/home/yourSeason.ts'];
  assert(!/\.gain\s*[<>]/.test(pure) && !/Gain\s*[<>]/.test(pure), 'no gain-vs-gain comparison in the tile builder');
});

Deno.test("the component's this-week branch never draws a score: no money formatter between `case 'this':` and its break", () => {
  const src = SOURCES['components/home/YourSeason.tsx'];
  const a = src.indexOf("case 'this':");
  const block = src.slice(a, src.indexOf('break;', a));
  assert(a > 0 && block.length > 20);
  assert(!/formatMoney|keepMoney|\.gain\b/.test(block), 'this week shows a ring, the live dot, a letter or "Bye" and never a score');
});
