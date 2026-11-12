/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Card } from '@/components/sp/Card';
import { Text } from '@/components/sp/Text';
import { Button } from '@/components/sp/Button';
import { radius, space } from '@/constants/tokens';
import SymbolSearchField from '@/components/SymbolSearchField';
import { supabase } from '@/lib/supabase';
import { seamRpc } from '@/lib/game/seamCalls';
import type { ShapedSearchResult } from '@/lib/symbolSearch';
import { keepDots } from '@/lib/game/keepDots';
import { QueueRow } from '@/components/game/QueueRow';
import { useQueueQuotes } from '@/lib/game/useQueueQuotes';
import { useQueueMarketLine } from '@/lib/game/useQueueMarketLine';
import { savedQueueFrom } from '@/lib/game/draftQueueRead';
import { moveItem, removeItem, addSymbol, queueRefusalLine, queueBaseline, rebaseQueue, QUEUE_MAX } from '@/lib/game/draftQueue';

export interface QueueEditorProps {
  leagueId: string;
  initial: string[];
  /** The list the server stored (set_draft_queue's `symbols`). */
  onSaved: (saved: string[]) => void;
  /** Stocks already drafted in the league (the live room; upper case). They leave the list at once, with no
   * Save step (decision 19). The lobby drafts nothing, so it passes none. */
  drafted?: ReadonlySet<string>;
}

/** One Set for the life of the module: useSymbolSearch takes `ownedSymbols` as an effect dependency, so a fresh
 * `new Set()` per render cancelled the 300 ms debounce on every parent re-render and the search never fired
 * (the spinner for ever; W8 tap-through). The queue marks nothing as owned. */
const NO_OWNED_SYMBOLS: Set<string> = new Set();
/** The same for `drafted`: one empty Set, so the lobby's editor never sees a "new" drafted set per render. */
const NOTHING_DRAFTED: ReadonlySet<string> = new Set();

/** The draft queue (3c): the stocks auto-pick takes first. Move, remove and add, then
 * save. The save is the server's set_draft_queue, and the server's refusal decides. */
export function QueueEditor({ leagueId, initial, onSaved, drafted = NOTHING_DRAFTED }: QueueEditorProps) {
  // The saved list: what the server stored, minus anything drafted (decision 19, lib/game/draftQueue.ts).
  const baseline = queueBaseline(initial, drafted);
  const baselineKey = baseline.join(',');
  const draftedKey = [...drafted].sort().join(',');
  const [queue, setQueue] = useState<string[]>(() => baseline);
  // A change the SERVER made (a pick pruned the queue, a re-read, a save landing) moves the list with it, in this
  // render: never a local difference that asks to be saved.
  const [seen, setSeen] = useState({ baseline, draftedKey });
  if (seen.baseline.join(',') !== baselineKey || seen.draftedKey !== draftedKey) {
    setSeen({ baseline, draftedKey });
    setQueue((q) => rebaseQueue(q, seen.baseline, baseline, drafted));
  }
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = queue.join(',') !== baselineKey;
  // The company and the draft search's price for every queued stock, read when the card opens (and for a stock added later).
  const { names, prices } = useQueueQuotes(queue);
  const closedLine = useQueueMarketLine();

  const onSelect = (r: ShapedSearchResult) => {
    if (!r.selectable) return;
    setQueue((q) => addSymbol(q, r.symbol));
    setSearch('');
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await seamRpc('set_draft_queue', { p_league_id: leagueId, p_symbols: queue });
    setSaving(false);
    const res = data as { ok?: boolean; reason?: string; symbols?: unknown } | null;
    if (error || !res || res.ok !== true) {
      Alert.alert('Not saved', queueRefusalLine(String(res?.reason ?? 'unknown'), res?.symbols));
      return;
    }
    onSaved(savedQueueFrom(res, queue));
  };

  return (
    <Card style={[styles.card, styles.searchCard]}>
      <Text variant="tag" tone="secondary">{keepDots(`Your queue · ${queue.length} of ${QUEUE_MAX}`)}</Text>
      {/* Rule 12 (the sweep, row 2): "If you step away, we'll auto-pick from your queue…" is cut. The room's first-time tip says it, once
          (lib/shell/firstTimeTipPolicy.ts). The empty queue's line is NOT built: it is not approved. */}
      {closedLine ? <Text variant="caption" tone="secondary" subOf="tag">{closedLine}</Text> : null}
      <View>
        {queue.map((sym, i) => (
          <QueueRow
            key={sym}
            index={i}
            count={queue.length}
            symbol={sym}
            name={names[sym.toUpperCase()]}
            price={prices[sym.toUpperCase()]}
            onMove={(delta) => setQueue((q) => moveItem(q, i, delta))}
            onRemove={() => setQueue((q) => removeItem(q, i))}
          />
        ))}
      </View>
      {queue.length < QUEUE_MAX ? (
        <SymbolSearchField value={search} onChangeText={setSearch} onSelect={onSelect} selectedSymbol="" ownedSymbols={NO_OWNED_SYMBOLS} captureAction="typeq" clearOnSelect />
      ) : null}
      {/* Save appears with something to save, beside the line that says so; it's a secondary
          pill, so the room's one primary stays Draft (§9C: one accent, small). */}
      {dirty ? (
        <View style={styles.save}>
          <Button label="Save queue" variant="secondary" onPress={() => void save()} disabled={saving} status={saving ? 'loading' : 'idle'} fullWidth />
          <Text variant="caption" tone="secondary" style={styles.center}>Not saved yet.</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // The sp Card has no padding or radius of its own (callers set both; DraftCountdownCard's).
  card: { borderRadius: radius.lg, padding: space[5], gap: space[2] },
  // The sp Card clips (overflow hidden), which cut the search's dropdown off at the card edge;
  // a search card lets it overflow, above the cards that follow it.
  searchCard: { overflow: 'visible', zIndex: 10 },
  save: { marginTop: space[2], gap: space[2] },
  center: { textAlign: 'center' },
});
