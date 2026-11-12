// What each dead end on a takeover link shows (PRODUCT_RULES, "Every dead end on a takeover or invite link takes the same form";
// board #call-refusal-family, Giorgio's sign-off 2026-11-12). Pure: the icon, the words and which action each button runs, over the
// EXISTING copy. The landing (components/shell/TakeoverLanding.tsx) draws it as a RefusalScreen and binds the actions.
//
//   taken                      person      "Someone already took this team."                     [Go to Home]
//   dead (gone, invalid_code…) unlink      "This invite link doesn't work anymore." / "Ask for a new one."   [Go to Home]
//   member                     league      "You're already in {league}."                         [Open the league]
//   rate_limited, a moment     clock       "Too many tries." / "Wait a moment, then try again."  [Try again] · Not now
//   rate_limited, an hour      clock       "Too many tries." / "Try again later."                [Not now]   (no Try again: it would fail)
//   unknown                    offline     "Couldn't reach the league." / "Check your connection, then try again."  [Try again] · Not now

import type { IconName } from '../../components/sp/logic/icon';
import { INVITE_COPY } from '../invite/inviteCopy';
import { COPY as MONEY_COPY } from '../money/moneyCopy';
import { JOIN_COPY, blockMessage } from '../join/joinPreview';
import { splitRefusal } from '../refusalSplit';
import { keepName } from './keepName';
import type { RateWait } from './takeoverReply';
import { GO_TO_HOME, NOT_NOW, OPEN_THE_LEAGUE, TAKEN_LINE, TRY_LATER } from './deleteCopy';

export type RefusalAction = 'home' | 'open' | 'retry' | 'notNow';

export interface RefusalSpec {
  icon: IconName;
  heading: string;
  line?: string;
  primary: { label: string; action: RefusalAction };
  secondary?: { label: string; action: RefusalAction };
}

/** The landing states that are dead ends. */
export type RefusalState =
  | { kind: 'taken' }
  | { kind: 'dead' }
  | { kind: 'member'; leagueName: string }
  | { kind: 'rate_limited'; wait: RateWait }
  | { kind: 'unknown' };

/** The edge limiter's short window is "a moment" (shipped Join line); the hour's lockout, or anything we can't tell, is "later". */
export function waitLine(w: RateWait): string {
  return w === 'moment' ? JOIN_COPY.rateLimited : TRY_LATER;
}

export function takeoverRefusal(state: RefusalState): RefusalSpec {
  switch (state.kind) {
    case 'taken':
      return { icon: 'person', heading: TAKEN_LINE, primary: { label: GO_TO_HOME, action: 'home' } };
    case 'dead':
      return { icon: 'unlink', ...splitRefusal(INVITE_COPY.dead), primary: { label: GO_TO_HOME, action: 'home' } };
    case 'member':
      // One sentence with the league's name in it: never split (a name can hold ". "). The NAME alone goes through keepName, so it
      // wraps as one piece ("You're already in / Stock Scudetto.", never "Stock / Scudetto."); the string source is unchanged.
      return { icon: 'league', heading: blockMessage('already_member', { name: keepName(state.leagueName), max: 0 }), primary: { label: OPEN_THE_LEAGUE, action: 'open' } };
    case 'rate_limited': {
      const words = splitRefusal(waitLine(state.wait));
      // The hour's lockout has nothing to retry now: only "Not now" (Design Lead gate). A moment's wait keeps "Try again".
      return state.wait === 'later'
        ? { icon: 'clock', ...words, primary: { label: NOT_NOW, action: 'notNow' } }
        : { icon: 'clock', ...words, primary: { label: MONEY_COPY.tryAgain, action: 'retry' }, secondary: { label: NOT_NOW, action: 'notNow' } };
    }
    case 'unknown':
      return { icon: 'offline', ...splitRefusal(JOIN_COPY.unreachable), primary: { label: MONEY_COPY.tryAgain, action: 'retry' }, secondary: { label: NOT_NOW, action: 'notNow' } };
  }
}
