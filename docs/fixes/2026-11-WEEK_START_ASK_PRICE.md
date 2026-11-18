# Week-start prices taken from the ask (2026-11-16) — fix and repair

## What happened

`snapshot-week-start` runs Monday 14:35Z, five minutes after the open. For a symbol with no IEX 1Day bar yet, it fell back to `/stocks/quotes/latest` and stored `quote.ap || quote.bp`, the ASK first. Thin names, mostly foreign ADRs, had no IEX trade yet, and their IEX ask was far from the market. Rows written Mon 2026-11-16 14:35:04-06Z, against `symbols.last_price` on Tuesday:

| symbol | stored | market | ratio |
|---|---|---|---|
| TM | 247.75 | 212.44 | 1.166 |
| AVAL | 4.66 | 4.065 | 1.146 |
| BCH | 44.27 | 39.16 | 1.130 |
| KB | 120.18 / 120.03 / 120.02 (three leagues) | | |

KB's three prices a second apart prove a live quote was used. `snapshot-week-end` and `process-week-results` had the same ask-first fallback.

## The fix (branch `fix/snapshot-price-fallback`)

There is now one price rule, `supabase/functions/_shared/week-price.ts`, used by all three functions:

1. The official bar: the session's 1Day bar, its open (week start) or close (week end).
2. Else the last trade, only if it happened inside the session window.
3. Else the bid/ask midpoint, only if:
   - both sides exist with size;
   - the quote is not crossed;
   - the quote is inside the window;
   - the spread is at most 2% of the midpoint.
4. Else no price. The league aborts all-or-nothing and the retry prices it. For week start, that is the +5 min retries, then Tuesday's run from Monday's completed bar.

An ask or a bid alone is never a price. If a bar request itself fails (a 429, a 5xx or a timeout), its symbols are not sent to the live steps either. The bar may well exist, so they stay unpriced and the league retries. Which step priced each symbol is logged as `... open prices: {counts, nonBar, unpriced}`. There is no column for it.

## The repair (Giorgio runs it)

`snapshot-week-start` has a re-price mode. It is reached only with the cron key and the body `{"mode":"reprice_week_start", ...}`; the cron's `{}` is the normal run. It re-prices that session's league-weeks' non-mid-week rows to the session's 1Day bar OPEN, and it reads the bar only, never a trade or a quote. Its rules:

- It is a dry run unless `"dry_run": false`.
- It skips any league-week that has an end price or whose close has passed.
- It never writes a null or a zero. A symbol with no bar is listed as `no_bar` and left as it is.
- It is idempotent, and each write is guarded on the old price.
- It never writes `cron_job_status`.

The key never leaves the database: the request is sent from the SQL editor with the vault secret the cron uses.

**Deadline:** the real run must finish before Fri 2026-11-20 21:00Z. After the close, the mode refuses the week.

**Known trade-off (needs an owner decision before Mon 2026-11-23).** The old code always found some price, often a bad one. The new code can find none.

- **When it heals:** a symbol that trades on IEX at all that day is priced, by the +5 min retry or by Tuesday's run from Monday's bar.
- **When it does not:** a held symbol with **no IEX trade the whole session** has no bar the next day either. Its league's baseline (or close) never lands, so that week is unscoreable for every holder in the league. `cron_job_status` goes `retrying` → `failed`, and the log line lists the symbol under `unpriced`.
- **Options, not built:**
  - a human override path;
  - a `prev_close` fallback (the previous session's bar close, as its own source) after retries run out;
  - an alert on `failed` plus `unpriced`.

The re-price mode cannot fix such a symbol either. It reports the symbol as `no_bar` and leaves the row as it is.

### Step 5: the previous close (branch `fix/always-a-price`, 2026-11-17)

Giorgio's ruling: "There always needs to be a price for a stock." So the rule now has a step 5. When steps 1-4 answer cleanly that there is no price, the job uses the stock's most recent real daily close (an IEX 1Day bar's `c`, fetched from Alpaca). Its source is `prev_close`.

- **When:** only on a job's last attempt (week start 14:45Z; week end 21:15Z and the Mon/Tue heals), or for a past session (Tuesday's week-start run). Earlier attempts still wait for the real open or close.
- **How far back:** week start, the 5 market sessions before the open. Week end and scoring, only this week's sessions, never a close from before the week opened.
- **Never on a failure:** if any request fails (bar, trade, quote, or step 5's own), the symbol stays unpriced and the league retries, exactly as before. Reasons: `bar_fetch_failed`, `trade_fetch_failed`, `quote_fetch_failed`, `prev_close_fetch_failed`.
- **No close in range:** the symbol stays unpriced as `no_recent_close` and is logged (a delisted or long-halted stock).
- **Log:** `... open prices:` / `close prices:` now show `TM=prev_close@212.1(2026-11-13)` in `nonBar`, a `prev_close` count, and `prevClose` (the range, or `off`).
- The re-price mode is unchanged: it writes the session's bar open only, never a previous close.

### 0. Deploy (after the PR merges)

```bash
git -C /Users/giorgio/fantasy-stock-deploy fetch origin && git -C /Users/giorgio/fantasy-stock-deploy checkout --detach origin/main
```

From `/Users/giorgio/fantasy-stock-deploy`:

```bash
supabase functions deploy snapshot-week-start --project-ref haiaaifjcclsvmkfqgmd
```

```bash
supabase functions deploy snapshot-week-end --project-ref haiaaifjcclsvmkfqgmd
```

```bash
supabase functions deploy process-week-results --project-ref haiaaifjcclsvmkfqgmd
```

Each "Uploading asset" list must include `_shared/week-price.ts`. The week-start list must also include `snapshot-week-start/reprice.ts`. Then download the deployed code and grep it for the new mode:

```bash
supabase functions download snapshot-week-start --project-ref haiaaifjcclsvmkfqgmd --workdir /tmp/wsdl && grep -rl "reprice_week_start" /tmp/wsdl
```

### 1. Dry run (SQL editor)

```sql
select net.http_post(
  url := 'https://haiaaifjcclsvmkfqgmd.supabase.co/functions/v1/snapshot-week-start',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_apikey' limit 1)
  ),
  body := '{"mode":"reprice_week_start","session_date":"2026-11-16","dry_run":true}'::jsonb,
  timeout_milliseconds := 180000
) as request_id;
```

Wait about 30 seconds, then read the response. Put in the `request_id` the first query returned:

```sql
select id, status_code, error_msg, content::jsonb
from net._http_response where id = <request_id>;
```

A body that is not a valid re-price request gets a 400 and runs nothing. A typo can no longer start the real snapshot job.

**Paste back:** `status_code` and the whole `content`. It holds no secrets: just league names, user ids, symbols and prices.

What to look for in `content`:
- `totals.reprice`: the rows a real run would change.
- `totals.no_bar` should be 0. If it is not, those rows are listed and will be left as they are. `price_errors` should be `[]`. If it is not, a bar request failed: run the dry run again rather than going on.
- `league_weeks`: League B (week 1), Uhhhh_1105 (week 1) and the test leagues (week 6) should show `status: "eligible"`. Any other status says why a league was skipped.
- `rows`: each row shows `old`, `new` and `ratio`. TM, for example, should show old 247.75, new about 212.

### 2. The real run

Send the same request with `"dry_run":false`:

```sql
select net.http_post(
  url := 'https://haiaaifjcclsvmkfqgmd.supabase.co/functions/v1/snapshot-week-start',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_apikey' limit 1)
  ),
  body := '{"mode":"reprice_week_start","session_date":"2026-11-16","dry_run":false}'::jsonb,
  timeout_milliseconds := 180000
) as request_id;
```

Read it with the same `net._http_response` query. Expected:
- `totals.repriced` equals the dry run's `totals.reprice`;
- `totals.conflict` is 0;
- `totals.write_error` is 0.

### 3. Verify the effect, not the status

a) Send the dry run (step 1) again. Expect `totals.reprice: 0`, which shows the repair is idempotent.

b) Each symbol should now carry one Monday price across all leagues. Expect zero rows, except any `no_bar` symbols from step 1:

```sql
select s.symbol, count(distinct s.week_start_price) as prices,
       min(s.week_start_price), max(s.week_start_price)
from week_snapshots s
join (select distinct league_id, week_number from matchups
      where (week_start at time zone 'UTC')::date = '2026-11-16') m
  on m.league_id = s.league_id and m.week_number = s.week_number
where s.entered_mid_week = false
group by s.symbol
having count(distinct s.week_start_price) > 1;
```

c) Nothing should be far from the market any more. Expect zero rows, or only names that really moved 7% since Monday:

```sql
select l.name, s.week_number, s.symbol, s.week_start_price, sy.last_price,
       round(s.week_start_price / nullif(sy.last_price, 0), 3) as ratio
from week_snapshots s
join leagues l on l.id = s.league_id
join (select distinct league_id, week_number from matchups
      where (week_start at time zone 'UTC')::date = '2026-11-16') m
  on m.league_id = s.league_id and m.week_number = s.week_number
left join symbols sy on sy.symbol = s.symbol
where s.entered_mid_week = false
  and s.week_start_price / nullif(sy.last_price, 0) not between 0.93 and 1.07
order by ratio desc;
```

### Does the app pick it up?

Yes, on its next fetch; nothing needs refreshing:
- Home (`get_home_league`) and the matchup screens (`useMemberSnapshots`, `useAllMatchups`) read `week_snapshots.week_start_price` live.
- The phone caches the view only in memory, and it refetches on every league switch and on its live poll.
- No weekly gain is stored before scoring: `matchups.team1_gain` is written only by `process-week-results`, after Friday's close.
