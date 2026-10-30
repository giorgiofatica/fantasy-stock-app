/**
 * usePortfolioLedger: the league's get_portfolio_ledger, loaded once per league and shared by the
 * stock sheet, Portfolio, Search, Trade history and the roster (3e), until a trade invalidates it
 * (invalidatePortfolioLedger, from useTradeSubmit); then every mounted hook reloads (ledgerCache.ts).
 * Failures are never cached, so a retry really retries. A malformed response
 * is refused (see portfolioLedger.parsePortfolioLedger).
 */
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { createLedgerCache } from './ledgerCache';
import { parsePortfolioLedger, type PortfolioLedger } from './portfolioLedger';
import { MONEY_FIXTURE, MONEY_FIXTURE_CONFIG } from './devFixture';
import { buildStressMarket } from './stressFixture';
import { CAPTURE_DELAY_MS, CAPTURE_DRAFT_TODAY, CAPTURE_FAIL, CAPTURE_TEAMS, MATCHUP_FIXTURE_VARIANT, SEAM_ON, captureFailsOnce } from '../game/devSeam';
import { SEAM_LEAGUE, SEAM_ME } from '../game/seamTables';
import { SEAM_DRAFT_TODAY_AT, seamPortfolioLedger } from './portfolioSeam';
import { HOME_FIXTURE } from '../home/devFixture';

const ledgerCache = createLedgerCache<PortfolioLedger>(async (leagueId) => {
  const { data, error } = await supabase.rpc('get_portfolio_ledger', { p_league_id: leagueId });
  if (error) {
    console.warn('[ledger] get_portfolio_ledger failed', error.message);
    return null;
  }
  const parsed = parsePortfolioLedger(data);
  if (!parsed) {
    console.warn('[ledger] get_portfolio_ledger response refused (malformed)');
    return null;
  }
  return parsed;
});

/** A trade changed (or a refusal contradicted) this league's ledger: every screen reloads it. */
export function invalidatePortfolioLedger(leagueId: string): void {
  ledgerCache.invalidate(leagueId);
}

/** Loads the ledger for a league, de-duplicated and cached on success. */
export function loadPortfolioLedger(leagueId: string): Promise<PortfolioLedger | null> {
  // DEV fixture: the stress ledger, no network (see devFixture.ts).
  // The game capture seam (EXPO_PUBLIC_GAME_SEAM): the Matchup fixture's league ledger, so the
  // stock sheet Sell opens from the player card is the real sheet over fixture data.
  if (SEAM_ON) {
    const ledger = CAPTURE_FAIL || captureFailsOnce('get_portfolio_ledger') ? null : seamPortfolioLedger(MATCHUP_FIXTURE_VARIANT, HOME_FIXTURE, SEAM_ME, SEAM_LEAGUE.gianluigi, CAPTURE_DRAFT_TODAY ? SEAM_DRAFT_TODAY_AT : null, CAPTURE_TEAMS);
    return CAPTURE_DELAY_MS > 0 ? new Promise((r) => setTimeout(() => r(ledger), CAPTURE_DELAY_MS)) : Promise.resolve(ledger);
  }
  if (MONEY_FIXTURE_CONFIG) {
    // The load_fail scenario is the LoadFailure state; every other scenario reads the stress ledger.
    return Promise.resolve(MONEY_FIXTURE_CONFIG.scenario === 'load_fail' ? null : buildStressMarket().ledger);
  }
  return ledgerCache.load(leagueId);
}

export interface PortfolioLedgerState {
  status: 'loading' | 'ready' | 'error';
  ledger: PortfolioLedger | null;
  /** True when this hook's load was a network read, not a cache hit. */
  fetchedNow: boolean;
  /** Re-runs the load. Use it after an error (failures are never cached); a trade reloads by itself. */
  refresh: () => void;
}

export function usePortfolioLedger(leagueId: string | null): PortfolioLedgerState {
  const [state, setState] = useState<Omit<PortfolioLedgerState, 'refresh'> & { forLeague: string | null }>({ status: 'loading', ledger: null, fetchedNow: false, forLeague: leagueId });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!leagueId) {
      setState({ status: 'error', ledger: null, fetchedNow: false, forLeague: leagueId });
      return;
    }
    let cancelled = false;
    const wasCached = ledgerCache.has(leagueId);
    setState((prev) => {
      // Refresh in place: reloading the SAME league after a trade keeps showing what it had until
      // the fresh ledger lands, so Portfolio never flashes its skeleton behind a closing sheet.
      const keep = prev.forLeague === leagueId && prev.ledger !== null && prev.status === 'ready';
      return keep
        ? { ...prev, ledger: ledgerCache.peek(leagueId) ?? prev.ledger }
        : { status: 'loading', ledger: ledgerCache.peek(leagueId) ?? null, fetchedNow: false, forLeague: leagueId };
    });
    loadPortfolioLedger(leagueId).then((ledger) => {
      if (cancelled) return;
      setState({
        status: ledger ? 'ready' : 'error',
        ledger,
        fetchedNow: !wasCached,
        forLeague: leagueId,
      });
    });
    return () => {
      cancelled = true;
    };
    // `tick` re-runs the load: after an error, or when a trade invalidated this league.
  }, [leagueId, tick]);

  useEffect(() => {
    if (!leagueId) return;
    return ledgerCache.subscribe((id) => {
      if (id === leagueId) setTick((t) => t + 1);
    });
  }, [leagueId]);

  // The state belongs to the league it was loaded for: for the one render after the league id
  // changes (before the effect resets it), report loading, never the previous league's result
  // (a "didn't load" flashed at launch while the id arrived — W4 Portfolio capture).
  if (state.forLeague !== leagueId) return { status: 'loading', ledger: null, fetchedNow: false, refresh };
  return { status: state.status, ledger: state.ledger, fetchedNow: state.fetchedNow, refresh };
}
