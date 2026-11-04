/**
 * The W4 Home gate's fixes (Design Lead, 2026-10-13, BLOCK on bdd450a7): one test per fix,
 * each with a mutation run at hand-back. Pure logic where it exists; source guards for
 * wiring the Deno runtime can't render.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { buttonRadius, PILL_RADIUS } from '../components/sp/logic/buttonStatus.ts';
import { rangeTabWidth, tabLabelWidth, TAB_MIN, TAB_LABEL_PAD } from '../components/sp/logic/gameNight.ts';
import { clearOf } from '../constants/tokens/color.ts';
import { radius } from '../constants/tokens/radius.ts';
import { draftStartStatusFixture, scheduledFixtureStartMs } from '../lib/game/autoStartFixture.ts';
import { heroMetaLine } from '../lib/home/calmHome.ts';

const code = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');

// ── The primary button is a pill (§9C, the board's .dr-btn) ────────────────────
Deno.test('every sp Button is a pill (radius 999): primary, secondary, ghost, destructive, the compact sm', () => {
  for (const v of ['primary', 'secondary', 'ghost', 'destructive'] as const) assertEquals(buttonRadius(v), PILL_RADIUS, v);
  assertEquals(PILL_RADIUS, radius.pill);
  const btn = SOURCES['components/sp/Button.tsx'];
  // One radius for every variant AND size (no size-keyed override of the shape).
  assert(btn.includes('borderRadius: buttonRadius(variant),'));
  assertEquals((btn.match(/borderRadius/g) ?? []).length, 1);
});

// ── 2. Equal-width range tabs, the underline the label's width ──────────────────
Deno.test('range tabs: one width for every tab, the widest label + 16, at least 44', () => {
  const labels = ['1W', '1M', 'Season'];
  const w = rangeTabWidth(labels);
  assertEquals(w, Math.max(TAB_MIN, Math.max(...labels.map((l) => tabLabelWidth(l))) + TAB_LABEL_PAD));
  assert(w >= TAB_MIN);
  assertEquals(rangeTabWidth(['1W', '1M']), TAB_MIN); // short labels still get a 44pt target
  assert(rangeTabWidth(labels, 1.3) > w); // the label grows to its cap…
  assertEquals(rangeTabWidth(labels, 3), rangeTabWidth(labels, 1.3)); // …and no further
  const pills = SOURCES['components/sp/gn/RangePills.tsx'];
  assert(pills.includes("const tabWidth = variant === 'tabs' ? rangeTabWidth(options, fontScale) : undefined;"));
  assert(pills.includes('[styles.tab, { width: tabWidth }]'));
  assert(/tab:\s*\{\s*minWidth: 44,\s*paddingTop: space\[2\],\s*alignItems: 'center',/.test(pills));
  // The underline sits in a view that hugs the label, so it spans the LABEL, not the box.
  assert(pills.includes('<View testID="range-tab-label">'));
  assert(/rowTabs:\s*\{\s*gap: 0,/.test(pills));
});

// ── 5. The champion wash fades to gold at alpha 0 ──────────────────────────────
Deno.test("a token faded out ends on itself at alpha 0, never 'transparent'", () => {
  assertEquals(clearOf('#AD7300'), 'rgba(173, 115, 0, 0)');
  assertEquals(clearOf('#ECAE30'), 'rgba(236, 174, 48, 0)');
  assertEquals(clearOf('#FFF'), 'rgba(255, 255, 255, 0)');
  const card = SOURCES['components/home/SeasonCompleteCard.tsx'];
  assert(card.includes('colors={[colors.medalGold, clearOf(colors.medalGold)]}'));
  assert(!code(card).includes("'transparent'"));
});

// ── 6. The pre-draft fixture's order line is the draft time minus an hour ───────
Deno.test("the pre-draft fixture's order time is the scheduled draft time − 1h (one draft day, not two)", () => {
  const now = Date.UTC(2026, 9, 13, 2, 0);
  const status = draftStartStatusFixture('scheduled', false, now);
  assertEquals(status.starts_at, new Date(scheduledFixtureStartMs(now)).toISOString());
  const src = SOURCES['lib/home/usePreDraftData.ts'];
  assert(src.includes('finalizeAt: new Date(scheduledFixtureStartMs(Date.now()) - 60 * 60 * 1000).toISOString(),'));
  assert(!src.includes("'2026-10-03T22:00:00.000Z'"));
});

// ── The axis labels cap at 1.3x (the shared Chart) ─────────────────────────────
Deno.test("the gn Chart's axis labels follow Dynamic Type only to 1.3x", () => {
  const chart = SOURCES['components/sp/gn/Chart.tsx'];
  assert(chart.includes('export const AXIS_MAX_SCALE = 1.3;'));
  assert(chart.includes('const fontScale = Math.min(deviceScale, AXIS_MAX_SCALE);'));
  assert(chart.includes('maxFontSizeMultiplier={AXIS_MAX_SCALE}'));
});

// ── P3s ───────────────────────────────────────────────────────────────────────
Deno.test('the hero meta wraps only between segments: spaces inside a segment are non-breaking, the dot stays left', () => {
  const nb = ' ';
  assertEquals(heroMetaLine(['2nd of 6', '4–1', 'Week 6 of 14']), `2nd${nb}of${nb}6${nb}· 4–1${nb}· Week${nb}6${nb}of${nb}14`);
  assertEquals(heroMetaLine(['Week 1 of 14', '']), `Week${nb}1${nb}of${nb}14`);
  assertEquals(heroMetaLine([null, '0–0']), '0–0');
  const hero = SOURCES['components/home/HomeHero.tsx'];
  assert(hero.includes('heroMetaLine([`${ordinal(rank)} of ${totalPlayers}`, record, weekOrRound])'));
  assert(hero.includes('heroMetaLine([weekOrRound, record])'));
});

Deno.test('Standings: the title at 17/800, its left edge on the rows\' rank glyphs (8 + 12)', () => {
  const card = SOURCES['components/home/StandingsCard.tsx'];
  assert(card.includes('<Text variant="headline" style={styles.title}>{STANDINGS_CARD_TITLE}</Text>'));
  assert(/title:\s*\{\s*fontWeight: '800',/.test(card));
  assert(/paddingHorizontal: space\[4\],/.test(card));
  assert(/paddingHorizontal: space\[3\],\s*paddingBottom/.test(card)); // the card's own 8
  assert(SOURCES['components/sp/gn/ManagerRow.tsx'].includes('paddingHorizontal: space[4],'));
});

Deno.test('This week: the two scores share a baseline when a name wraps (halves stretch, score at the bottom)', () => {
  const card = SOURCES['components/home/ThisWeekCard.tsx'];
  assert(/half:\s*\{\s*flex: 1,\s*minWidth: 0,\s*gap: space\[3\],\s*paddingVertical: space\[4\],\s*justifyContent: 'space-between',/.test(card));
  assert(!/halves:\s*\{[^}]*alignItems/.test(card)); // the row's default stretch makes them equal height
});

// ── Found in the capture pass ───────────────────────────────────────────────────
Deno.test("the live mark sits under the CLAMPED end dot (Monday's dot is held 10pt in, its halo on screen)", () => {
  const chart = SOURCES['components/sp/gn/Chart.tsx'];
  assert(chart.includes('(i === geometry.points.length - 1 && end ? end.x : p.x) - bleed'));
});

Deno.test("Home's Standings rows stack (name over the numbers) at large text, so a name never shrinks to a letter", async () => {
  const src = SOURCES['components/sp/gn/ManagerRow.tsx'];
  const { excerptStacks, EXCERPT_STACK_SCALE } = await import('../components/sp/logic/gameNight.ts');
  assertEquals(EXCERPT_STACK_SCALE, 1.5);
  assertEquals([excerptStacks(1), excerptStacks(1.35), excerptStacks(1.5), excerptStacks(2.35)], [false, false, true, true]);
  assert(src.includes('const stacked = excerpt && excerptStacks(fontScale);'));
  assert(src.includes('<Text variant="body" numberOfLines={2} style={yourNameStyle(isYou)} color={seatInk}>{name}</Text>')); // color: the deleted seat's secondary ink (account deletion W4)
});

// ── Pass-2 DL items (2026-10-13) ───────────────────────────────────────────────
Deno.test('This week at XL: "vs {name}" stacks under its avatar on ONE line, shrink-to-fit, capped by the total', async () => {
  const { nameBesideAvatar, stackedNameCap } = await import('../components/sp/logic/gameNight.ts');
  // 17e XL: a half is ~175pt wide; less the pads (28) and the avatar footprint (32 + 8 gap) leaves ~107pt.
  assertEquals(nameBesideAvatar('vs Gianluigi B.', 107, 13 * 2.35), false); // XL: stacks
  assertEquals(nameBesideAvatar('vs Gianluigi B.', 107, 13), true); // Large: beside
  // The cap never lets the name outgrow the total under it, and never below 1x.
  assert(stackedNameCap({ totalText: '+$90.45', totalPt: 28 * 1.2, innerWidth: 147, namePt: 13 }) <= 1.3);
  assertEquals(stackedNameCap({ totalText: '+$1,233,153,000.00', totalPt: 33.6, innerWidth: 60, namePt: 13 }), 1);
  const card = SOURCES['components/home/ThisWeekCard.tsx'];
  assert(card.includes('const oppStacked = halvesWidth > 0 && !nameBesideAvatar(oppLabel, besideRoom, NAME_PT * fontScale);'));
  assert(card.includes('const oppNameCap = stackedNameCap({ totalText: oppText, totalPt: SCORE_PT * Math.min(fontScale, SCORE_MAX_SCALE), innerWidth: halfInner, namePt: NAME_PT });'));
  assert(card.includes('numberOfLines={1} adjustsFontSizeToFit minimumFontScale={NAME_MIN_SCALE} maxFontSizeMultiplier={oppNameCap}'));
  assert(card.includes('oppStacked ? styles.whoStackedMirror : styles.whoMirror'));
  assert(card.includes('const oppLabel = vsOpponentLabel(opponentName);')); // "vs" kept
});

Deno.test('"Through Week N" is hidden while N = 0; the chevron and the card still open Standings', async () => {
  const { throughWeekShown } = await import('../lib/home/calmHome.ts');
  assertEquals([throughWeekShown(0), throughWeekShown(1), throughWeekShown(5)], [false, true, true]);
  const card = SOURCES['components/home/StandingsCard.tsx'];
  assert(card.includes('{throughWeekShown(throughWeek) ? ('));
  // The chevron stays OUTSIDE the condition (rendered unconditionally right after it), and
  // exactly one chevron exists, so it can't hide with the label.
  assert(card.includes(') : null}\n          <Icon name="chevronRight" size="callout" tone="text2" />'));
  assertEquals((card.match(/chevronRight/g) ?? []).length, 1);
  assert(card.includes('onPress={() => router.push(STANDINGS_HREF)}'));
});

Deno.test("Week 1 Monday's lone point: at the RIGHT end (now), centred on the base, never clipped", async () => {
  const { buildLine } = await import('../components/sp/logic/lineChart.ts');
  const box = { width: 390, height: 108, padLeft: 2, padRight: 12, padTop: 12, padBottom: 9 };
  // The merged Monday: one point, the axis from Sep 21 to Sep 21 (a zero-length domain).
  const up = buildLine([{ t: 0, value: 213.6 }], [0, 0], 0, box);
  assertEquals(up.end!.x, box.width - box.padRight); // now: the right end
  assertEquals(up.baseY, box.padTop + (box.height - box.padTop - box.padBottom) / 2); // base centred
  assert(up.end!.y >= box.padTop && up.end!.y < up.baseY); // above the base by its move, inside the plot
  const down = buildLine([{ t: 0, value: -50 }], [0, 0], 0, box);
  assert(down.end!.y > down.baseY && down.end!.y <= box.height - box.padBottom); // below, inside
});
