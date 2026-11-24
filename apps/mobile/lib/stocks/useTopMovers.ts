/**
 * useTopMovers: the "Top movers" chip's read (`get_league_top_movers`, topMovers.ts has the rules). Members only, at most 25 rows,
 * paced by the server (PT429). Through the capture seam, and ERROR-CHECKED: supabase-js `.rpc()` resolves `{ data, error }` and
 * does not throw (CLAUDE.md, success signals #5), so a refusal (42501), a paced PT429 or a dropped connection is a read that did
 * not load, never "no movers".
 *
 * WHEN IT READS. Only while the chip is showing (`active`): when it is chosen, when the league changes, on pull to refresh and
 * Try again, after a trade in that league (a bought mover leaves the list, a sold one may return: the same ledger signal the
 * Available list reloads on), and every MOVERS_REFRESH_MS while it stays open (the job re-ranks every 5 minutes; 12 reads an
 * hour is far inside the server's 120). A clock tick every minute re-judges the ranking's age, so a ranking that goes old while
 * the chip is on screen turns into "didn't load" without waiting for the next read.
 *
 * ANSWERS ARE TIED TO THEIR REQUEST: one counter, and a late answer for a league the manager has left, or one that a newer read
 * has overtaken, is dropped. A failed read keeps the rows already shown (the age rule still judges them), as a later page of the
 * Available list does; a failed FIRST read has nothing to keep and the chip shows the failure.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { seamRpc } from '../game/seamCalls';
import { subscribePortfolioLedgerInvalidation } from '../money/usePortfolioLedger';
import { isFailedMoversRead, moversArgs, parseMovers, rankingIsFresh, type MoversRead } from './topMovers';

export const MOVERS_REFRESH_MS = 5 * 60 * 1000;
export const MOVERS_CLOCK_MS = 60 * 1000;

export interface UseTopMovers {
  /** 'loading': nothing read yet for this league. 'failed': the read did not load and there is nothing to keep. 'ready': `read` is set. */
  status: 'loading' | 'ready' | 'failed';
  read: MoversRead | null;
  /** The clock the age rule is judged against (ms), advanced every minute while the chip is on. */
  now: number;
  /** Pull to refresh and Try again: reads again; resolves when the answer has landed. */
  reload: () => Promise<void>;
}

interface Held {
  leagueId: string | null;
  status: 'loading' | 'ready' | 'failed';
  read: MoversRead | null;
}

export function useTopMovers(leagueId: string | null, active: boolean): UseTopMovers {
  const [held, setHeld] = useState<Held>({ leagueId, status: 'loading', read: null });
  const [now, setNow] = useState(() => Date.now());
  const focused = useIsFocused();
  const seq = useRef(0);
  const leagueRef = useRef(leagueId);
  leagueRef.current = leagueId;
  // Unmounted: a read still in flight lands nowhere (Copilot on #607). The effect below sets it on mount and clears it on unmount.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    const league = leagueRef.current;
    if (!league) return;
    const id = ++seq.current;
    // A failed first read asked again shows the skeleton (feedback for Try again); rows already on screen stay until the answer lands.
    setHeld((h) => (h.leagueId === league && h.read ? h : { leagueId: league, status: 'loading', read: null }));
    let result: { data: unknown; error: unknown };
    try {
      result = await seamRpc('get_league_top_movers', moversArgs(league));
    } catch (e) {
      result = { data: null, error: e };
    }
    // Unmounted, or a newer read or another league has overtaken this one.
    if (!mounted.current || id !== seq.current || league !== leagueRef.current) return;
    const read = isFailedMoversRead(result) ? null : parseMovers(result.data);
    setNow(Date.now());
    setHeld((h) => {
      const prev = h.leagueId === league ? h.read : null;
      if (read) return { leagueId: league, status: 'ready', read };
      // A failed read: keep what this league already showed (the age rule judges it), else the failure.
      return prev ? { leagueId: league, status: 'ready', read: prev } : { leagueId: league, status: 'failed', read: null };
    });
  }, []);

  // The league changed: nothing of the old league's ranking is shown for the new one while its first read is in flight.
  const heldFor = held.leagueId === leagueId ? held : { leagueId, status: 'loading' as const, read: null };

  useEffect(() => {
    if (!active || !focused || !leagueId) return;
    // Coming back to the chip (or the tab): a ranking that has gone old is dropped for the skeleton, never flashed as "didn't load" while the new read is on its way.
    setHeld((h) => (h.leagueId === leagueId && rankingIsFresh(h.read, Date.now()) ? h : { leagueId, status: 'loading', read: null }));
    void load();
    const reread = setInterval(() => void load(), MOVERS_REFRESH_MS);
    const clock = setInterval(() => setNow(Date.now()), MOVERS_CLOCK_MS);
    const off = subscribePortfolioLedgerInvalidation((invalidated) => {
      if (invalidated === leagueRef.current) void load();
    });
    return () => {
      clearInterval(reread);
      clearInterval(clock);
      off();
    };
  }, [active, focused, leagueId, load]);

  return { status: heldFor.status, read: heldFor.read, now, reload: load };
}
