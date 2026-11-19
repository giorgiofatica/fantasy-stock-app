import { StocksScreen } from '@/components/stocks/StocksScreen';
import { LeagueListGate } from '@/components/shell/NoLeagueState';

// The Stocks tab (the fifth, last on the right; Giorgio, 2026-11-18): the list of stocks nobody in the league
// owns, search, and the way into buying (the stock sheet opens from any row through MoneyHost).
export default function StocksTab() {
  // Onboarding W4: no leagues is the one shared state on every tab.
  return (
    <LeagueListGate title="Stocks">
      <StocksScreen />
    </LeagueListGate>
  );
}
