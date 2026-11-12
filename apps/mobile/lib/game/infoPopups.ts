/**
 * The "i" popups (UX rule 13; PRODUCT_RULES, "Optional context for a choice we defined", "The 'i'
 * popup has two pages", "No button in the 'i' popup: just the dots", "The 'i' popup lines,
 * approved as written"). Pure, so tests-deno pins every word and every rule about which option
 * gets one. Spec: the Design Lead's board, docs/design/screens/info-i.jsx (POPS).
 *
 *   Page 1: the option's name and its one line. Page 2: the name and a picture. Two dots under the
 *   card are the page control (tap to turn, "Page 1 of 2" to VoiceOver); a swipe turns the page.
 *   No "See an example", no "Back". The x closes from either page; it always opens on page 1.
 *
 * Two kinds of words live here, and they are NOT the same:
 *   - the LINES are Giorgio's, approved as written ("the popup lines are approved", 2026-11-11).
 *     Straight apostrophes, as PRODUCT_RULES writes them. Never reword one.
 *   - the VOICEOVER descriptions of each picture are the Design Lead's, drawn on the board and
 *     approved as written by Giorgio (the Orchestrator relayed his yes). Each is ONE constant
 *     (VO_*), so a wording change is a one-line edit.
 */

export type InfoKey = 'matchup' | 'equal' | 'tiers' | 'cap' | 'order' | 'playoffs' | 'draftable';

// ── The lines: approved as written (PRODUCT_RULES). ─────────────────────────────────────────
export const LINE_MATCHUP = 'Each week you play one team, and the bigger dollar gain wins. The best records make the playoffs.';
export const LINE_EQUAL = 'Every pick is the same dollar amount, so a cheap stock counts as much as an expensive one.';
export const LINE_TIERS = 'One share per pick. Each slot takes stocks in its own price range.';
export const LINE_CAP = "One share per pick. Your shares together can't cost more than the cap.";
export const LINE_ORDER = 'Random shuffles it an hour before the draft; Manual lets you set it. Either way, it reverses each round.';
export const LINE_PLAYOFFS = "The top teams in the standings play a bracket. When it doesn't fill evenly, the top seeds skip the first round.";
export const LINE_DRAFTABLE =
  'Off: stocks at $1 or more, on a major US exchange, from companies worth $250 million or more. On: every US stock, penny stocks too.';

// ── The picture's VoiceOver description: ONE constant per popup. Approved as written by Giorgio. ──
export const VO_MATCHUP =
  'Example: in week 3 you gain $24.10 and Marco R. loses $8.30, so you win the week. After the regular season, the top 4 play off.';
export const VO_EQUAL = 'Example: $1,000 buys 89.29 shares of F, 5.36 of NVDA, or 1.09 of COST.';
export const VO_TIERS =
  'Example: slot 1 takes stocks under $50, like F. Slot 2, $50 to $300, like NVDA. Slot 3, $300 and up, like COST.';
export const VO_CAP = 'Example: one share each of F, NVDA, MSFT and COST costs $1,628.10, under a $2,500 cap.';
export const VO_ORDER =
  'Example: in round 1 Marco R. picks first and Elena M. fourth. In round 2 it runs back: Elena M. picks fifth and Marco R. eighth.';
export const VO_PLAYOFFS =
  'Example with 6 teams: seeds 1 and 2 skip the wild card round, 3 plays 6 and 4 plays 5, then the semifinals and the final.';
export const VO_DRAFTABLE =
  'Off, only draftable stocks like AAPL, NVDA, COST and F. On, every US stock, including a $0.40 stock or a $90 million company.';

export interface InfoPopupCopy {
  /** The option's name: page 1 and page 2's heading, and the dialog's VoiceOver label. */
  title: string;
  line: string;
  /** What VoiceOver says for the picture on page 2. */
  voice: string;
}

export const INFO_POPUPS: Record<InfoKey, InfoPopupCopy> = {
  matchup: { title: 'Matchup', line: LINE_MATCHUP, voice: VO_MATCHUP },
  equal: { title: 'Equal stakes', line: LINE_EQUAL, voice: VO_EQUAL },
  tiers: { title: 'Price tiers', line: LINE_TIERS, voice: VO_TIERS },
  cap: { title: 'Budget cap', line: LINE_CAP, voice: VO_CAP },
  order: { title: 'Draft order', line: LINE_ORDER, voice: VO_ORDER },
  playoffs: { title: 'Playoff teams', line: LINE_PLAYOFFS, voice: VO_PLAYOFFS },
  draftable: { title: 'Non-draftable stocks', line: LINE_DRAFTABLE, voice: VO_DRAFTABLE },
};

export const INFO_KEYS = Object.keys(INFO_POPUPS) as InfoKey[];

// ── Which options get an "i" (board: "Which options get an i" / "Which don't, and why"). ────────
// Duration has NO entry while it is hidden: it has no row to sit on (PRODUCT_RULES, "Duration is
// hidden in Create league until it is built"). Its approved line stays in createLeagueSteps.ts
// (DURATION_TYPE_OPTION.infoLine) for when it comes back.

/** The League type card's options. Matchup alone for now, and it still gets its "i" (PRODUCT_RULES,
 * "The League type card stays, with Matchup alone"). */
export const LEAGUE_TYPE_INFO: Readonly<Record<string, InfoKey>> = { matchup: 'matchup' };

/** The Stakes step's three modes (keyed by leagues.stake_mode). */
export const STAKE_MODE_INFO: Readonly<Record<string, InfoKey>> = {
  fixed_notional: 'equal',
  price_tiers: 'tiers',
  budget_cap: 'cap',
};

/** The controls that are not option rows: ONE "i" each (Draft order's covers Random and Manual). */
export const CONTROL_INFO = {
  draftOrder: 'order',
  playoffTeams: 'playoffs',
  nonDraftable: 'draftable',
} as const satisfies Record<string, InfoKey>;

/** Choices that get NO "i", and why (the board's list). Rounds is Giorgio's "1a": "no i on Rounds".
 * Any limit never gets one either: it shows as the reason beside a control that cannot act. */
export const NO_INFO: readonly string[] = [
  'Pick clock',
  'Managers',
  'Regular season',
  'Rounds',
  'Draft time',
  'Stake per slot',
  'Budget cap amount',
];

export function infoForLeagueType(type: string): InfoKey | null {
  return LEAGUE_TYPE_INFO[type] ?? null;
}

export function infoForStakeMode(mode: string): InfoKey | null {
  return STAKE_MODE_INFO[mode] ?? null;
}

// ── The popup's accessibility words (spoken only). ──────────────────────────────────────────
/** The "i"'s VoiceOver label: "About Matchup". */
export function aboutLabel(title: string): string {
  return `About ${title}`;
}
export const CLOSE_LABEL = 'Close';
export const PAGES = 2;

/** The page dots' VoiceOver label: "Page 1 of 2" (a swipe up or down turns the page). */
export function pageLabel(page: number, total: number = PAGES): string {
  return `Page ${page} of ${total}`;
}

/** Clamp a page to 1..total. */
export function clampPage(page: number, total: number = PAGES): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(total, Math.max(1, Math.round(page)));
}

/** The page a horizontal scroll offset rests on, 1-based: a swipe settles on the nearer page. */
export function pageAtOffset(offsetX: number, pageWidth: number, total: number = PAGES): number {
  if (!(pageWidth > 0) || !Number.isFinite(offsetX)) return 1;
  return clampPage(Math.round(offsetX / pageWidth) + 1, total);
}

/** The offset a tap on a dot scrolls to. */
export function offsetForPage(page: number, pageWidth: number, total: number = PAGES): number {
  return (clampPage(page, total) - 1) * Math.max(0, pageWidth);
}

/** VoiceOver's swipe up/down on the dots: the next or previous page, held at the ends. */
export function turnPage(page: number, direction: 1 | -1, total: number = PAGES): number {
  return clampPage(page + direction, total);
}

// ── The pictures' example numbers: ONE source for what is drawn and what VoiceOver says. ─────────
export const EXAMPLE_PRICES = { F: 11.2, NVDA: 186.42, MSFT: 512.18, COST: 918.3 } as const;
export type ExampleTicker = keyof typeof EXAMPLE_PRICES;
export const EXAMPLE_STAKE = 1000;
export const EXAMPLE_CAP = 2500;
/** Shares a dollar stake buys at a price, as the Equal stakes picture prints them. */
export function exampleShares(ticker: ExampleTicker, stake: number = EXAMPLE_STAKE): number {
  return stake / EXAMPLE_PRICES[ticker];
}
/** One share of each ticker, added up (the Budget cap picture's total). */
export function exampleCapTotal(tickers: readonly ExampleTicker[]): number {
  return tickers.reduce((sum, t) => sum + EXAMPLE_PRICES[t], 0);
}
export function exampleMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── DEV captures only ────────────────────────────────────────────────────────────────────────
/** EXPO_PUBLIC_INFO_FIXTURE=<key>[:<page>] opens that popup once, on a cold launch, through the real `open()` (so a close acts
 * like production): the gate's stills need no tap. A release bundle never reads it (the caller passes `__DEV__`), and an
 * unrecognised value is ignored, never guessed. */
export function parseInfoFixture(isDev: boolean, raw: string | undefined): { info: InfoKey; page: number } | null {
  if (!isDev || !raw) return null;
  const [key, page] = raw.split(':');
  if (!(INFO_KEYS as readonly string[]).includes(key)) return null;
  return { info: key as InfoKey, page: page === '2' ? 2 : 1 };
}
