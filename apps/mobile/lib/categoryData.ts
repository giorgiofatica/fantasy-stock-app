// Category / eligibility data helpers for league setup + drafting UI (Phase 4
// item 4 — DR-001). Mirror of apps/web/src/utils/categoryData.js — reads the
// seeded reference tables (authenticated SELECT); symbols only through the
// count functions (a signed-in client reads symbol, name, is_draftable only).
// Display-only: the authoritative eligibility logic lives in the
// validate-and-record-pick / record-trade edge functions.
import { supabase } from './supabase';
import { capacityLine, slotConfigIssues, slotIssueAway } from './game/slotBuilderCopy';
import { numberOrThrow, rowsOrThrow } from './readResult';

export type StakeMode = 'fixed_notional' | 'price_tiers' | 'budget_cap';

// What each mode means is behind its "i" (UX rule 13; lib/game/infoPopups.ts), never a paragraph under the option (rule 12).
export const STAKE_MODE_OPTIONS: Array<{ value: StakeMode; label: string; icon: string }> = [
  {
    value: 'fixed_notional',
    label: 'Equal stakes',
    icon: 'scale',
  },
  {
    value: 'price_tiers',
    label: 'Price tiers',
    icon: 'layers',
  },
  {
    value: 'budget_cap',
    label: 'Budget cap',
    icon: 'wallet',
  },
];

/** Plain-language label for a league's stake_mode; 'Not set' for NULL/legacy leagues. */
export function stakeModeLabel(stakeMode: StakeMode | null | undefined): string {
  return STAKE_MODE_OPTIONS.find((o) => o.value === stakeMode)?.label ?? 'Not set';
}

export const DEFAULT_NOTIONAL_PER_SLOT = 1000;
// A one-share cap must BIND: at the old $100k default a full roster of the
// priciest shares never touched it. ~$2,500 for a 6-slot roster forces real
// trade-offs.
export const DEFAULT_BUDGET_CAP = 2500;

export interface Category {
  id: string;
  slug: string;
  name: string;
  is_misc: boolean;
}

export interface SlotDraft {
  /** Held as a STRING so the field can be empty mid-edit (a number here made
   * the input unclearable — BUG 3). '' fails validateSlotConfig (count >= 1),
   * so Next/save stay blocked rather than silently defaulting. */
  slotCount: string;
  priceMin: string; // '' = no floor
  priceMax: string; // '' = no ceiling
  categoryId: string; // '' = flex
}

let categoriesCache: Category[] | null = null;

export async function fetchCategories(): Promise<Category[]> {
  if (categoriesCache) return categoriesCache;
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, is_misc')
    .order('display_order', { ascending: true });
  if (error) return [];
  categoriesCache = (data as Category[]) || [];
  return categoriesCache;
}

/** The live coverage of the enrichment cron: active symbols, and how many of them it has enriched. Two totals from
 * symbols_enrichment_progress (20261205000300): the client may not read symbols.active / enriched_at directly. */
export async function fetchEnrichmentProgress(): Promise<{ enriched: number; total: number; partial: boolean }> {
  // A FAILED read throws (the caller's catch says "couldn't check"); it never reads as "no symbols yet".
  const rows = rowsOrThrow(await supabase.rpc('symbols_enrichment_progress'), 'symbols progress');
  const row = rows[0] as { enriched?: unknown; total?: unknown } | undefined;
  const e = numberOrThrow(row?.enriched, 'symbols enriched');
  const t = numberOrThrow(row?.total, 'symbols total');
  // Coverage gate: mirrors @fantasy-stock/shared coverageIsPartial (Metro can't
  // import the workspace package). enriched/total are the LIVE symbol counts
  // read just above; below 90% coverage the per-slot counts are suppressed.
  return { enriched: e, total: t, partial: t === 0 || e < t * 0.9 };
}

/** Draftable symbols matching one slot: the exact overrides-replace-rule count, made on the server by
 * count_slot_matches (20261205000300), which returns a number and never a row. Filtering on last_price or
 * gics_industry here would need those columns readable, and a filter is a read (S1, "nothing scrapable"). */
export async function countSlotMatches(
  slot: { priceMin: number | null; priceMax: number | null; categoryId: string | null },
): Promise<number> {
  const res = await supabase.rpc('count_slot_matches', {
    p_price_min: slot.priceMin,
    p_price_max: slot.priceMax,
    p_category_id: slot.categoryId,
  });
  if (res.error) throw new Error(`slot count: ${res.error.message ?? 'read failed'}`);
  return numberOrThrow(res.data, 'slot count');
}

/**
 * HARD slot-config errors (block Next/save — distinct from soft feasibility
 * warnings). Once a league has ANY slots, the server validator requires every
 * pick to land in an unfilled slot, so total slot count must equal
 * stocks-per-team exactly: fewer wedges the draft mid-round (every further
 * pick refused with no_eligible_slot); more is dead config the roster can
 * never fill. Inverted brackets would be rejected by the DB CHECK at save
 * time with an opaque error, so they are caught here instead.
 */
export function validateSlotConfig(slots: SlotDraft[], numRounds: number): string[] {
  // The checks live in slotConfigIssues (pure, tested); these are the lines shown
  // away from a slot (Design Lead ruling). SlotBuilder shows each slot's own
  // issue on the slot instead.
  const { slots: issues, capacity } = slotConfigIssues(slots, numRounds);
  const errors = issues.map(slotIssueAway);
  if (capacity) errors.push(capacityLine(capacity.total, capacity.rounds));
  return errors;
}

/** Replace a league's slot definitions (commissioner-only via RLS; callers
 * gate on draft_status). */
export async function saveLeagueSlots(leagueId: string, slots: SlotDraft[]): Promise<void> {
  const { error: delErr } = await supabase
    .from('league_draft_slots')
    .delete()
    .eq('league_id', leagueId);
  if (delErr) throw delErr;
  if (!slots.length) return;
  const rows = slots.map((s, i) => ({
    league_id: leagueId,
    slot_index: i,
    slot_count: Math.max(1, Number(s.slotCount) || 1),
    price_min: s.priceMin === '' ? null : Number(s.priceMin),
    price_max: s.priceMax === '' ? null : Number(s.priceMax),
    category_id: s.categoryId || null,
  }));
  const { error: insErr } = await supabase.from('league_draft_slots').insert(rows);
  if (insErr) throw insErr;
}

/** Load a league's slots into SlotDraft form for the builder. */
export async function loadLeagueSlots(leagueId: string): Promise<SlotDraft[]> {
  const { data } = await supabase
    .from('league_draft_slots')
    .select('slot_index, slot_count, price_min, price_max, category_id')
    .eq('league_id', leagueId)
    .order('slot_index', { ascending: true });
  return (data || []).map((r) => ({
    slotCount: String(r.slot_count),
    priceMin: r.price_min == null ? '' : String(r.price_min),
    priceMax: r.price_max == null ? '' : String(r.price_max),
    categoryId: (r.category_id as string) ?? '',
  }));
}
