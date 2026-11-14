// Category / eligibility data helpers for league setup + drafting UI (Phase 4
// item 4 — DR-001). Reads only the seeded reference tables (categories,
// category_rules, symbol_category_overrides — authenticated SELECT per Phase 2
// RLS). symbols is column-limited for a signed-in client (symbol, name,
// is_draftable; S1 CONTRACT, deferred/20261205000400): the counts go through RPCs, and
// fetchSymbolCategories answers from overrides only (null = not known). The
// web app is paused (APP_PAUSED).
//
// These MIRROR the server's rules for display: the authoritative eligibility
// logic lives in the validate-and-record-pick / record-trade edge functions
// (supabase/functions/_shared/draft-validation.ts). Overrides REPLACE the rule
// category; unclassified symbols are flex-only.
import { supabase } from '../supabase/supabaseClient';
import { coverageIsPartial } from '@fantasy-stock/shared';

export const STAKE_MODE_OPTIONS = [
  {
    value: 'fixed_notional',
    label: 'Equal stakes',
    help: 'Every roster slot represents the same simulated dollar stake (fractional shares). Price-neutral — pick any stock without price strategy.',
  },
  {
    value: 'price_tiers',
    label: 'Price tiers',
    help: 'One share per pick; roster slots are bracketed by share-price ranges you define below. Expensive stocks compete only with each other.',
  },
  {
    value: 'budget_cap',
    label: 'Budget cap',
    help: 'One share per pick; the total of your roster’s share prices must fit under the league cap. Keep the cap tight so choices matter.',
  },
];

/** Plain-language label for a league's stake_mode; 'Not set' for NULL/legacy leagues. */
export function stakeModeLabel(stakeMode) {
  return STAKE_MODE_OPTIONS.find((o) => o.value === stakeMode)?.label ?? 'Not set';
}

export const DEFAULT_NOTIONAL_PER_SLOT = 1000;
// A one-share cap must BIND to shape the draft: at the old $100k default a
// full roster of the priciest shares never touched it. ~$2,500 for a 6-slot
// roster forces real trade-offs (avg ~$400/share).
export const DEFAULT_BUDGET_CAP = 2500;

let categoriesCache = null;

/** Ordered category list [{id, slug, name, is_misc}]. Cached per page load. */
export async function fetchCategories() {
  if (categoriesCache) return categoriesCache;
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, is_misc')
    .order('display_order', { ascending: true });
  if (error) return [];
  categoriesCache = data || [];
  return categoriesCache;
}

/**
 * Display eligibility for one symbol, from its overrides only.
 * Returns { categories: [{id, slug, name}], classified: true } when the symbol
 * has overrides, else null ("not known": DraftPage draws no category line).
 *
 * The rule path (symbols.gics_industry -> category_rules) is gone: a signed-in
 * client may not read gics_industry (S1 CONTRACT, deferred/20261205000400), and mobile reads it
 * only for a league's own picks (get_league_pick_industries). A quote of a stock
 * nobody has drafted has no such path, so this answers "not known" rather than
 * a wrong "unclassified". The web app is paused (APP_PAUSED).
 */
export async function fetchSymbolCategories(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  const cats = await fetchCategories();
  const byId = new Map(cats.map((c) => [c.id, c]));

  const { data: ovr, error } = await supabase
    .from('symbol_category_overrides')
    .select('category_id')
    .eq('symbol', sym);
  if (error || !ovr || ovr.length === 0) return null;
  return { categories: ovr.map((o) => byId.get(o.category_id)).filter(Boolean), classified: true };
}

/** {enriched, total, partial} over the active universe — feasibility counts
 * are lower bounds while the enrichment cron is still covering the universe.
 * Two totals from symbols_enrichment_progress (20261205000300): a signed-in
 * client may not read symbols.active / enriched_at directly. */
export async function fetchEnrichmentProgress() {
  const { data } = await supabase.rpc('symbols_enrichment_progress');
  const row = Array.isArray(data) ? data[0] : null;
  const t = Number(row?.total) || 0;
  const e = Number(row?.enriched) || 0;
  // partial reads LIVE coverage (e/t read above) against the shared threshold.
  return { enriched: e, total: t, partial: coverageIsPartial(e, t) };
}

/**
 * How many draftable symbols match one slot definition? count_slot_matches
 * (20261205000300) makes the overrides-REPLACE-rule count on the server and
 * returns a number, never rows: filtering on last_price / gics_industry here
 * would need those columns readable, and a filter is a read (S1).
 */
export async function countSlotMatches({ priceMin, priceMax, categoryId }) {
  const { data } = await supabase.rpc('count_slot_matches', {
    p_price_min: priceMin != null && priceMin !== '' ? Number(priceMin) : null,
    p_price_max: priceMax != null && priceMax !== '' ? Number(priceMax) : null,
    p_category_id: categoryId || null,
  });
  return Number(data) || 0;
}

/**
 * HARD slot-config errors (block create/save — distinct from soft feasibility
 * warnings). Mirror of the mobile validator: once a league has ANY slots the
 * server requires every pick to land in an unfilled slot, so total slot count
 * must equal stocks-per-team exactly; inverted brackets would fail the DB
 * CHECK at save time.
 */
export function validateSlotConfig(slots, numRounds) {
  const errors = [];
  if (slots.length === 0) return errors;
  let total = 0;
  slots.forEach((s, i) => {
    const count = Number(s.slotCount);
    if (!(count > 0)) errors.push(`Slot ${i + 1}: count must be at least 1.`);
    else total += count;
    const min = s.priceMin === '' || s.priceMin == null ? null : Number(s.priceMin);
    const max = s.priceMax === '' || s.priceMax == null ? null : Number(s.priceMax);
    if (min != null && max != null && min > max) {
      errors.push(`Slot ${i + 1}: min price is above max price.`);
    }
  });
  if (total !== numRounds) {
    errors.push(
      total > numRounds
        ? `Slots cover ${total} picks but each team drafts only ${numRounds} (stocks per team) — remove ${total - numRounds}.`
        : `Slots cover only ${total} of ${numRounds} picks — once slots exist, every pick needs an open slot, so the draft would jam after ${total}. Add ${numRounds - total} more.`,
    );
  }
  return errors;
}
