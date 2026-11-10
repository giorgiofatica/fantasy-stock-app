/**
 * usePreDraftData: PreDraftCard's own data fetch (get_draft_order +
 * get_league_display_names), extracted out of the component so the
 * DEV-ONLY fixture seam lives in a hook, not the component (Design Lead
 * ruling, 2026-09-30: states 6-waiting and 7 need real captures, and
 * PreDraftCard/DraftingCard's own direct Supabase calls -- unlike Home's
 * own useHomeLeague -- had no fixture path at all).
 *
 * PRODUCTION PATH: when HOME_FIXTURE is unset (every real user, and every
 * __DEV__=false release build, where HOME_FIXTURE is `null`
 * unconditionally), the effect makes the same
 * `Promise.all([get_draft_order, get_league_display_names])` call with the
 * same params and the same parsing (parseDraftOrder, in preDraftRead.ts).
 * What changed (W2, 2026-11-10, the stale order found on League B): it
 * re-reads whenever `refreshKey` changes (the caller passes
 * useDraftAutoStart's statusKey: the T-1h and T boundaries, the poll from
 * T, fixes, pull-to-refresh), keeps the last answer while it re-reads
 * (`loading` only before the first), never blanks on a failed re-read, and
 * re-checks shortly when the server says the order is due but not set.
 * The rules are pure: lib/home/preDraftRead.ts.
 */
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { seamRpc } from '@/lib/game/seamCalls';
import { HOME_FIXTURE } from './devFixture';
import { FIXTURE_USER_ID } from '@/lib/shell/fixtureIds';
import { scheduledFixtureStartMs } from '@/lib/game/autoStartFixture';
import {
  nextPreDraftData,
  orderRecheckDelayMs,
  PRE_DRAFT_EMPTY,
  type PreDraftData,
  type ReadResult,
} from './preDraftRead';

export type { PreDraftData, PreDraftMember } from './preDraftRead';

/** "3 of 4 joined, so the order isn't set yet" (Design Lead capture spec,
 * 2026-09-30) -- the board's own pre-draft-waiting sample. */
function fixturePreDraftWaiting(): PreDraftData {
  return {
    waiting: true,
    orderRevealed: null,
    members: [
      { userId: FIXTURE_USER_ID, displayName: 'Roberto B.', isBot: false },
      { userId: 'paolo', displayName: 'Paolo M.', isBot: false },
      { userId: 'gianluigi', displayName: 'Gianluigi B.', isBot: false },
    ],
    loading: false,
    finalizeAt: null,
    memberCount: 3,
    minMembers: 4,
  };
}

/** The board's plain "before the draft" sample: the order IS set (board
 * always shows the order-set line in this variant), well short of the
 * league's full roster. */
function fixturePreDraft(): PreDraftData {
  return {
    waiting: false,
    orderRevealed: [FIXTURE_USER_ID, 'paolo', 'gianluigi'],
    members: [
      { userId: FIXTURE_USER_ID, displayName: 'Roberto B.', isBot: false },
      { userId: 'paolo', displayName: 'Paolo M.', isBot: false },
      { userId: 'gianluigi', displayName: 'Gianluigi B.', isBot: false },
      { userId: 'luca', displayName: 'Luca V.', isBot: false },
      { userId: 'chiara', displayName: 'Chiara R.', isBot: false },
      { userId: 'marco', displayName: 'Marco T.', isBot: false },
    ],
    loading: false,
    // An hour before the 'scheduled' draft-start fixture's draft time (the server's
    // contract, finalize = draft − 1h). It was a fixed Sat Oct 3 while the draft time is
    // relative to now, so the card named two different days (W4 gate, 2026-10-13).
    finalizeAt: new Date(scheduledFixtureStartMs(Date.now()) - 60 * 60 * 1000).toISOString(),
    memberCount: 6,
    minMembers: 4,
  };
}

/** A read that threw (transport) is a failed read, like a resolved { error }. */
const FAILED: ReadResult = { data: null, error: { message: 'transport' } };

export function usePreDraftData(leagueId: string, refreshKey: number): PreDraftData {
  // The data is tagged with its league, so a league switch shows the loading state, never the last league's order.
  const [state, setState] = useState<{ leagueId: string; data: PreDraftData } | null>(null);
  // Bounded re-checks of an order that is due but not set yet (preDraftRead rule 2); a new key starts a new budget.
  const [recheck, setRecheck] = useState(0);
  const attempts = useRef(0);
  useEffect(() => {
    attempts.current = 0;
  }, [leagueId, refreshKey]);

  useEffect(() => {
    if (HOME_FIXTURE === 'pre_draft_waiting') {
      setState({ leagueId, data: fixturePreDraftWaiting() });
      return;
    }
    if (HOME_FIXTURE === 'pre_draft') {
      setState({ leagueId, data: fixturePreDraft() });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      let order: ReadResult = FAILED;
      let names: ReadResult = FAILED;
      try {
        [order, names] = await Promise.all([
          seamRpc('get_draft_order', { p_league_id: leagueId }),
          seamRpc('get_league_display_names', { p_league_id: leagueId }),
        ]);
      } catch {
        // Both stay FAILED: the last answer is kept (rule 1).
      }
      if (cancelled) return;
      setState((s) => ({ leagueId, data: nextPreDraftData(s?.leagueId === leagueId ? s.data : null, order, names) }));
      const delay = orderRecheckDelayMs(order, attempts.current);
      if (delay !== null) {
        timer = setTimeout(() => {
          attempts.current += 1;
          setRecheck((n) => n + 1);
        }, delay);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [leagueId, refreshKey, recheck]);

  return state?.leagueId === leagueId ? state.data : PRE_DRAFT_EMPTY;
}
