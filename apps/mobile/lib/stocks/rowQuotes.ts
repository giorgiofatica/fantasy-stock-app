/**
 * rowQuotes: the live price AND today's change of the Watching rows on screen. Pure (an injected fetcher and clock): tests-deno
 * pins every rule.
 *
 * WHY NOT useRowPrices. The Stocks list's batch `quote` call answers prices only; the day change (prevClose) comes from the
 * SINGLE-symbol lookup, the one the stock sheet reads (`ticker-quotes`: price, prevClose, changePercent). So a Watching row
 * asks that one per symbol, for the rows on screen only, and takes its price and its change from the SAME answer: the two
 * figures on a row can never come from two reads.
 *
 * COST CONTROL. A symbol read in the last 60 s is reused; a failed read is remembered 15 s as "no figures" and asked again;
 * at most `lanes` reads are in flight at once, across every mount. What is on screen is the latest entry whatever its age (a
 * stale figure beats a blank while the next read is made), the TTLs only decide whether to ask again.
 *
 * A FIGURE IS NEVER INVENTED. A price that is not a usable cent amount is "no price" (the row reads "–"); a change needs BOTH a
 * usable price and a positive previous close, else it is absent (the row draws no change line, never "0.00%").
 */
import { usablePrice } from '../game/queueRow';

export const QUOTE_TTL_MS = 60_000;
export const QUOTE_FAIL_TTL_MS = 15_000;
export const QUOTE_LANES = 3;

/** What one symbol's single lookup answered (a clean answer: either figure may be null), or that the read failed. */
export type QuoteAnswer = { ok: true; price: number | null; prevClose: number | null } | { ok: false };

/** What a row knows: absent while loading, then a price (or null) and a change (or null). */
export type RowQuote = { status: 'loading' } | { status: 'ready'; price: number | null; changePct: number | null };

/** (price − previous close) / previous close, in percent; null unless BOTH figures are usable. The sheet's own formula (stockSheetModel's todayChange). */
export function changePct(price: number | null | undefined, prevClose: number | null | undefined): number | null {
  if (!usablePrice(price)) return null;
  if (typeof prevClose !== 'number' || !Number.isFinite(prevClose) || prevClose <= 0) return null;
  return ((price - prevClose) / prevClose) * 100;
}

/** A `ticker-quotes` body as an answer. A body with an `error`, or one that is not an object, is a failed read. */
export function answerFromTickerQuote(data: unknown): QuoteAnswer {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false };
  const d = data as { price?: unknown; prevClose?: unknown; error?: unknown };
  if (d.error) return { ok: false };
  return {
    ok: true,
    price: usablePrice(d.price) ? d.price : null,
    prevClose: typeof d.prevClose === 'number' && d.prevClose > 0 ? d.prevClose : null,
  };
}

/**
 * The change as the board writes it: "+1.4% today" while the market is open, "+11.2% Fri" while it is closed (the last session's
 * change named by its day, Giorgio's yes to the words, 2026-11-22). One decimal on the board; a change that rounds to zero reads
 * "0.0%" unsigned. `dayWord` is "today" or the short weekday of the last close; null = the market's state is not known, so no word.
 */
export function changeText(pct: number | null, dayWord: string | null): string | null {
  if (pct === null) return null;
  const tenths = Math.round(Math.abs(pct) * 10);
  const body = tenths === 0 ? '0.0%' : `${pct < 0 ? '−' : '+'}${Math.floor(tenths / 10)}.${tenths % 10}%`;
  return dayWord ? `${body} ${dayWord}` : body;
}

/** Which way a change reads: loss, gain, or flat (a zero change is neither). */
export function changeTone(pct: number | null): 'gain' | 'loss' | 'flat' | null {
  if (pct === null) return null;
  const tenths = Math.round(Math.abs(pct) * 10);
  return tenths === 0 ? 'flat' : pct < 0 ? 'loss' : 'gain';
}

/** What VoiceOver says for a change: the figure with its word ("plus 1.4 percent today"), never the glyphs. */
export function changeSpoken(pct: number | null, dayWord: string | null): string | null {
  const text = changeText(pct, null);
  if (text === null) return null;
  const spoken = text.replace('+', 'plus ').replace('−', 'minus ').replace('%', ' percent');
  return dayWord ? `${spoken} ${dayWord}` : spoken;
}

/** The short weekday of an ISO instant in New York ("Fri"), or null when it does not parse. */
export function shortWeekdayEt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(d);
}

// ── The store ────────────────────────────────────────────────────────────────────────────────

/** Reads ONE symbol's lookup; may throw (a dropped connection) = a failed read. */
export type QuoteFetcher = (symbol: string) => Promise<QuoteAnswer>;

interface Entry {
  price: number | null;
  prevClose: number | null;
  ok: boolean;
  at: number;
}

export interface QuoteStore {
  peek(symbol: string): RowQuote | undefined;
  request(symbols: readonly string[], onSettle: () => void): void;
}

export function createQuoteStore(fetchOne: QuoteFetcher, now: () => number = Date.now, lanes: number = QUOTE_LANES): QuoteStore {
  const entries = new Map<string, Entry>();
  const waiting = new Map<string, Set<() => void>>();
  const queue: string[] = [];
  let active = 0;

  const fresh = (s: string) => {
    const e = entries.get(s);
    return !!e && now() - e.at < (e.ok ? QUOTE_TTL_MS : QUOTE_FAIL_TTL_MS);
  };

  function pump(): void {
    while (active < lanes && queue.length > 0) {
      const symbol = queue.shift()!;
      active++;
      void (async () => {
        let answer: QuoteAnswer;
        try {
          answer = await fetchOne(symbol);
        } catch {
          answer = { ok: false };
        }
        // A failed read drops the last good figures (never shown beside a failure) and is asked again after QUOTE_FAIL_TTL_MS.
        entries.set(symbol, answer.ok ? { price: answer.price, prevClose: answer.prevClose, ok: true, at: now() } : { price: null, prevClose: null, ok: false, at: now() });
        const who = waiting.get(symbol);
        waiting.delete(symbol);
        active--;
        if (who) for (const fn of who) fn();
        pump();
      })();
    }
  }

  return {
    peek(symbol) {
      const e = entries.get(symbol);
      if (!e) return undefined;
      return { status: 'ready', price: e.ok ? e.price : null, changePct: e.ok ? changePct(e.price, e.prevClose) : null };
    },
    request(symbols, onSettle) {
      for (const raw of symbols) {
        const s = raw.toUpperCase();
        const who = waiting.get(s);
        if (who) {
          who.add(onSettle);
          continue;
        }
        if (fresh(s)) continue;
        waiting.set(s, new Set([onSettle]));
        queue.push(s);
      }
      pump();
    },
  };
}
