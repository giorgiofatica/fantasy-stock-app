/**
 * The Create league done screen and its two remaining Alerts (3c-2; Design
 * Lead rulings, verbatim).
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assertEquals } from 'jsr:@std/assert';
import {
  CREATED_NO_DATE,
  CREATE_FAILED,
  GO_TO_LEAGUE,
  SLOTS_NOT_SAVED,
  createdTitle,
  createdWithoutDate,
  inviteShareMessage,
} from '../lib/game/createLeagueDone.ts';

Deno.test('the done screen: "{Name} is ready", with no subtitle (rule 12 cut "Share the invite code to bring your league in.")', () => {
  assertEquals(createdTitle('Office League'), 'Office League is ready');
  assertEquals(createdTitle('  Office League  '), 'Office League is ready');
  assertEquals(GO_TO_LEAGUE, 'Go to the league');
});

Deno.test('no draft date: TBD, or a date never picked', () => {
  assertEquals(createdWithoutDate(true, null), true);
  assertEquals(createdWithoutDate(false, null), true);
  assertEquals(createdWithoutDate(true, new Date('2026-10-10T23:00:00Z')), true);
  assertEquals(createdWithoutDate(false, new Date('2026-10-10T23:00:00Z')), false);
  assertEquals(CREATED_NO_DATE, 'Set a draft time before the draft can start.');
});

Deno.test('roster slots that did not save', () => {
  assertEquals(SLOTS_NOT_SAVED, {
    title: "Roster slots didn't save",
    message: "Your league was created, but its roster slots didn't save. Add them again in League settings.",
  });
});

Deno.test('a failed create never shows the raw message', () => {
  assertEquals(CREATE_FAILED, { title: "The league wasn't created", message: 'Check your connection, then try again.' });
});

Deno.test('the share text: Giorgio\'s sentence verbatim, then the invite link on its own line (W3)', () => {
  assertEquals(inviteShareMessage('K7Q2XR'), 'Join my league with code K7Q2XR\nhttps://fantasy-stock-app.vercel.app/join/K7Q2XR');
});

Deno.test('rule 12: the done screen passes no subtitle, and "Set a draft time…" stays only when there is no date', async () => {
  const { SOURCES } = await import('./sourceManifest.generated.ts');
  const screen = SOURCES['app/create-league.tsx'].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const done = screen.slice(screen.indexOf('if (created) {'), screen.indexOf('const last = step'));
  assertEquals(/subtitle=/.test(done), false, 'no subtitle under "{Name} is ready"');
  assertEquals(/Share the invite code/.test(screen), false);
  assertEquals(/\{created\.noDate \? \(\s*<Text[^>]*>\{CREATED_NO_DATE\}<\/Text>/.test(done), true, 'the draft-time fact stays, only without a date');
});
