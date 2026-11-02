/**
 * Design Lead rulings 2026-11-01 (1.3.0 (7) phone pass).
 *
 * (6) League settings' Commissioner row is STATIC in season (no chevron, no press feedback) with a caption in the Leave
 *     row's lock-caption style; before the draft and after the season it opens the hand-over sheet as before.
 * (7) An invite code is ONE unbreakable token (word joiners, hyphen included) that fits one line down to 0.6x, on every
 *     surface that shows one (a code on its own line: one fitted line; inside a sentence: word-joined); what the person
 *     copies or shares stays the plain code.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  COMMISSIONER_HANDOVER_LINE, LEAVE_LOCKED_LINE, commissionerRowView, leaveWindow, transferAllowed, type LeaveWindow,
} from '../lib/game/leaveLeague.ts';
import { WORD_JOINER, keepCode, keepCodeIn } from '../lib/game/keepDots.ts';
import { inviteShareMessage } from '../lib/game/leagueSettingsEntry.ts';
import { SOURCES } from './sourceManifest.generated.ts';

// ── (6) The Commissioner row ──

Deno.test('Commissioner row: pressable exactly when the title can change hands, static with the caption otherwise', () => {
  const all: LeaveWindow[] = ['before_draft', 'locked_order_set', 'locked_season', 'after_season'];
  for (const w of all) {
    const v = commissionerRowView(w);
    assertEquals(v.pressable, transferAllowed(w), w); // one rule, never two that can drift
    assertEquals(v.sub, v.pressable ? null : COMMISSIONER_HANDOVER_LINE, w);
  }
  assertEquals(commissionerRowView('before_draft'), { pressable: true, sub: null });
  assertEquals(commissionerRowView('after_season'), { pressable: true, sub: null });
  assertEquals(commissionerRowView('locked_season').pressable, false); // in season
  assertEquals(commissionerRowView('locked_order_set').pressable, false); // an hour before the draft
});

Deno.test('Commissioner row: in season is what leaveWindow says for a started draft', () => {
  assertEquals(commissionerRowView(leaveWindow({ seasonStatus: 'active', draftStatus: 'completed', draftDate: null }, Date.now())).pressable, false);
  assertEquals(commissionerRowView(leaveWindow({ seasonStatus: 'completed', draftStatus: 'completed', draftDate: null }, Date.now())).pressable, true);
});

Deno.test('Commissioner row: the caption is Design Lead\'s verbatim NEW copy, marked NEW, in the Leave lock caption\'s style', () => {
  assertEquals(COMMISSIONER_HANDOVER_LINE, 'You can hand over the commissioner role before the draft or after the season.');
  const src = SOURCES['lib/game/leaveLeague.ts'];
  assert(src.includes("= 'You can hand over the commissioner role before the draft or after the season.'; // NEW"));
  // Same style: a SettingRow `sub` is Text variant="caption" tone="secondary", like LeaveLeagueRow's sub.
  assert(SOURCES['components/game/SetupRows.tsx'].includes('<Text variant="caption" tone="secondary">\n            {sub}'));
  assert(SOURCES['components/game/LeaveLeagueSheets.tsx'].includes('<Text variant="caption" tone="secondary">{view.sub}</Text>'));
  assert(LEAVE_LOCKED_LINE.endsWith('.')); // both lines end in a period
});

Deno.test('League settings wires the Commissioner row through commissionerRowView (source guard)', () => {
  const s = SOURCES['app/league-settings.tsx'];
  assert(s.includes('const commissionerRow = commissionerRowView(membershipWindow);'));
  assert(s.includes('sub={commissionerRow.sub ?? undefined}'));
  assert(s.includes('onPress={commissionerRow.pressable ? () => {'));
  // The old inline rule is gone: no second copy of the window test beside it.
  assert(!s.includes('transferAllowed('));
  // SettingRow renders no chevron and no Pressable without onPress (the static state).
  const rows = SOURCES['components/game/SetupRows.tsx'];
  assert(rows.includes('if (!onPress) return body;'));
});

// ── (7) Invite codes ──

// The longest real code formats: the generator's 10 chars, the renewal's [A-Z0-9]{10}, and the phone-pass "ASC-0fc85d9d".
const CODES = ['ASC-0fc85d9d', 'ABCDEFGHJK', 'SERIEA7', 'SCUD26'];

Deno.test('keepCode: a word joiner between every glyph (the hyphen too); stripping them gives the plain code back', () => {
  for (const c of CODES) {
    const k = keepCode(c);
    assertEquals(k.replaceAll(WORD_JOINER, ''), c);
    assertEquals(k.split(WORD_JOINER).length - 1, [...c].length - 1);
  }
  assert(keepCode('ASC-0fc85d9d').includes(`-${WORD_JOINER}0`));
  assert(keepCode('ASC-0fc85d9d').includes(`C${WORD_JOINER}-`));
});

Deno.test('keepCode: a worst-case breaker finds no break opportunity inside a code', () => {
  for (const c of CODES) {
    const k = keepCode(c);
    for (let i = 1; i < k.length; i++) {
      const a = k[i - 1], b = k[i];
      const breakable = a !== WORD_JOINER && b !== WORD_JOINER;
      assert(!breakable, `${JSON.stringify(c)} could break before index ${i}`);
    }
  }
});

Deno.test('keepCodeIn: only the code is joined; the sentence still wraps around it', () => {
  const s = 'Follows who\'s in, up to 16. More can join with ASC-0fc85d9d until the draft.';
  const out = keepCodeIn(s, 'ASC-0fc85d9d');
  assertEquals(out.replaceAll(WORD_JOINER, ''), s);
  assert(out.includes(' join with A'));
  assert(out.includes('d until the draft.'));
  assertEquals(keepCodeIn(s, ''), s);
  assertEquals(keepCodeIn(s, 'NOPE'), s);
});

Deno.test('share and copy stay plain: no joiner reaches Share, and InviteCodeText draws the plain code on one fitted line', () => {
  for (const c of CODES) assert(!inviteShareMessage(c).includes(WORD_JOINER));
  const comp = SOURCES['components/game/InviteCodeText.tsx'];
  // The plain code: a selectable one copies what it draws, and a joiner takes its own letterSpacing (the Home card tracks
  // its code at 2pt: "A S C - 0 f c" with joiners). One line cannot wrap, so the joiners are not needed here.
  assert(comp.includes('{code}\n    </Text>'));
  assert(!comp.includes('keepCode('));
  // One line, fitted down to 0.6x.
  assert(comp.includes('numberOfLines={1}'));
  assert(/^\s+adjustsFontSizeToFit$/m.test(comp)); // the JSX attribute, not the word in the header comment
  assert(comp.includes('CODE_MIN_SCALE = 0.6'));
  assert(comp.includes('minimumFontScale={CODE_MIN_SCALE}'));
  // Nothing hands a joined string to Share or the clipboard.
  for (const f of ['app/league-settings.tsx', 'components/home/PreDraftCard.tsx', 'app/create-league.tsx', 'app/join-league.tsx']) {
    const s = SOURCES[f];
    assert(!/Share\.share\(\{ message: [^}]*keepCode/.test(s), f);
    assert(!/Clipboard[^\n]*keepCode/.test(s), f);
  }
});

Deno.test('every surface that shows an invite code draws it through the keep-together (source guard)', () => {
  assert(SOURCES['app/league-settings.tsx'].includes('<InviteCodeText variant="callout" style={[styles.bold, styles.tabular]} code={code} />'));
  assert(SOURCES['components/home/PreDraftCard.tsx'].includes('<InviteCodeText variant="callout" style={styles.code} code={inviteCode} />'));
  assert(SOURCES['components/game/DraftBlockersCard.tsx'].includes('<InviteCodeText variant="headline" selectable code={inviteCode} />'));
  assert(SOURCES['app/create-league.tsx'].includes('<InviteCodeText variant="title" style={styles.code} selectable code={created.inviteCode} />'));
  // Codes inside a line of copy: the join preview's caption and the renewal review's Teams sub-line.
  assert(SOURCES['app/join-league.tsx'].includes('`Invite code ${keepCode(trimmed.toUpperCase())}`'));
  assert(SOURCES['components/game/RenewalReview.tsx'].includes('sub={keepCodeIn(teams.sub, inviteCode)}'));
});

Deno.test('no screen draws an invite code as a bare Text (the surfaces the ruling named, plus a sweep)', () => {
  // Bare means `{inviteCode}` / `{code}` / `{created.inviteCode}` as a Text child. The sweep keeps a new surface honest.
  const bare = /<Text[^>]*>\s*\{(?:league\.invite_code|inviteCode|created\.inviteCode|code)\}\s*<\/Text>/;
  for (const [path, src] of Object.entries(SOURCES)) {
    if (!path.startsWith('app/') && !path.startsWith('components/')) continue;
    if (path === 'components/game/InviteCodeText.tsx') continue; // the one place a code is a Text's child
    assert(!bare.test(src), `${path} draws an invite code as a bare Text`);
  }
});
