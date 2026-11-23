import { useLeagueContext } from '@/lib/LeagueContext';
import { useSession } from '@/lib/SessionProvider';
import { usePortfolioLedger } from '@/lib/money/usePortfolioLedger';
import { sheetInputsFromLedger } from '@/lib/money/portfolioLedger';
import { deriveStockSheetFacts } from '@/lib/money/stockSheetFacts';
import { ownershipSuffix, type OwnershipSuffix } from '@/lib/money/stockSearchOwnership';
import { myHoldingsFromLedger } from '@/lib/money/portfolioModel';
import { MONEY_FIXTURE, MONEY_FIXTURE_CONFIG } from '@/lib/money/devFixture';
import { FIXTURE_LEAGUE_ID, fixtureLeague } from '@/lib/money/fixtureMode';
import { STRESS_CALLER } from '@/lib/money/stressFixture';
import { seamPortfolioLeague } from '@/lib/money/portfolioSeam';
import { MATCHUP_FIXTURE_VARIANT, PORTFOLIO_STAKE_VARIANT, SEAM_ON } from '@/lib/game/devSeam';

/**
 * useSearchOwnership: who owns a search result, for the Stocks tab's search (moved here from the retired stock-search
 * screen, unchanged). E-3: from the same league-wide ledger the stock sheet already reads (shared/cached, not a
 * new read, and never a new RPC). Budget and tier leagues: a buy needs a free slot; with every slot of yours held,
 * a free stock can't be bought until you sell (the sheet's own rosterFull rule), so its row says "No free slot".
 */
export function useSearchOwnership(): (symbol: string) => OwnershipSuffix {
  const { activeLeague } = useLeagueContext();
  const { user } = useSession();
  const leagueId = activeLeague?.id ?? (MONEY_FIXTURE ? FIXTURE_LEAGUE_ID : null);
  const userId = MONEY_FIXTURE ? STRESS_CALLER : (user?.id ?? null);
  const ledgerState = usePortfolioLedger(leagueId);
  const league = MONEY_FIXTURE_CONFIG
    ? fixtureLeague(MONEY_FIXTURE_CONFIG.stake)
    : SEAM_ON
      ? seamPortfolioLeague(PORTFOLIO_STAKE_VARIANT, MATCHUP_FIXTURE_VARIANT)
      : activeLeague;
  const roomless = !!league && !!ledgerState.ledger && !!userId
    && (league.stake_mode === 'budget_cap' || league.stake_mode === 'price_tiers')
    && myHoldingsFromLedger(ledgerState.ledger, userId).length >= league.num_rounds;

  function ownershipFor(symbol: string): OwnershipSuffix {
    if (!ledgerState.ledger || !userId) return { text: null, mine: false };
    const facts = deriveStockSheetFacts({ symbol, userId, ...sheetInputsFromLedger(ledgerState.ledger) });
    return ownershipSuffix(facts.owner, facts.conflict, roomless);
  }
  return ownershipFor;
}
