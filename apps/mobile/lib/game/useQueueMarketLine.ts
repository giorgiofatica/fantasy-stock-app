/**
 * The queue card's closed-market line ("Prices at Wednesday's close."): from the market status and calendar the league
 * shell already reads (LeagueContext), no new request. While the market is open, unknown or unread, there is no line.
 * The day is the last session's close, as Home's "at Thursday's close" names it (lastSessionCloseBefore).
 *
 * Capture seam only (EXPO_PUBLIC_QUEUE_MARKET_FIXTURE=closed): the market reads closed, and "now" is Thursday morning
 * of this week, so the last close is Wednesday's whatever day the capture is taken.
 */
import { useLeagueContext } from '../LeagueContext';
import { lastSessionCloseBefore } from '../time/marketWeek';
import { SEAM_ON } from './devSeam';
import { pricesClosedLine } from './queueRow';

/** This week's Thursday, 13:00 UTC (9 AM ET, before Thursday's open): Wednesday's close is the last one. */
export function thursdayMorning(now: Date): Date {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday + 3, 13, 0, 0));
}

export function useQueueMarketLine(): string | null {
  const { market, marketCalendar } = useLeagueContext();
  const fixtureClosed = SEAM_ON && process.env.EXPO_PUBLIC_QUEUE_MARKET_FIXTURE === 'closed';
  const now = fixtureClosed ? thursdayMorning(new Date()) : new Date();
  const status = fixtureClosed ? 'closed' : market?.status;
  return pricesClosedLine(status, lastSessionCloseBefore(now, marketCalendar));
}
