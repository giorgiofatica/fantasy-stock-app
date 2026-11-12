/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { Card } from '@/components/sp/Card';
import { Text } from '@/components/sp/Text';
import { Button } from '@/components/sp/Button';
import { WarnPanel } from '@/components/sp/WarnPanel';
import { radius, space } from '@/constants/tokens';
import SymbolSearchField from '@/components/SymbolSearchField';
import { seamRpc } from '@/lib/game/seamCalls';
import type { ShapedSearchResult } from '@/lib/symbolSearch';
import { keepDots } from '@/lib/game/keepDots';
import { QueueRow } from '@/components/game/QueueRow';
import { useQueueQuotes } from '@/lib/game/useQueueQuotes';
import { useQueueMarketLine } from '@/lib/game/useQueueMarketLine';
import { useCaptureAction } from '@/lib/money/captureScript';
import { moveItem, removeItem, addSymbol, queueBaseline, QUEUE_MAX } from '@/lib/game/draftQueue';
import { attachQueueAutosave, type QueueSaveHandlers } from '@/lib/game/queueAutosave';

export interface QueueEditorProps {
  leagueId: string;
  initial: string[];
  /** Every accepted save: the list the server stored (set_draft_queue's `symbols`). */
  onSaved: (saved: string[]) => void;
  /** Stocks already drafted in the league (the live room; upper case). They leave the list at once, on their own
   * (decision 19). The lobby drafts nothing, so it passes none. */
  drafted?: ReadonlySet<string>;
}

/** One Set for the life of the module: useSymbolSearch takes `ownedSymbols` as an effect dependency, so a fresh
 * `new Set()` per render cancelled the 300 ms debounce on every parent re-render and the search never fired
 * (the spinner for ever; W8 tap-through). The queue marks nothing as owned. */
const NO_OWNED_SYMBOLS: Set<string> = new Set();
/** The same for `drafted`: one empty Set, so the lobby's editor never sees a "new" drafted set per render. */
const NOTHING_DRAFTED: ReadonlySet<string> = new Set();

/** The draft queue (3c): the stocks auto-pick takes first. Move, remove and add; each change saves on its own a
 * moment after you stop (PRODUCT_RULES "Your queue saves as you go"; lib/game/queueAutosave.ts). The save is the
 * server's set_draft_queue, and the server's refusal decides. */
export function QueueEditor({ leagueId, initial, onSaved, drafted = NOTHING_DRAFTED }: QueueEditorProps) {
  // The server's list: what it stored, minus anything drafted (decision 19, lib/game/draftQueue.ts).
  const baseline = queueBaseline(initial, drafted);
  const baselineKey = baseline.join(',');
  const draftedKey = [...drafted].sort().join(',');
  const handlers: QueueSaveHandlers = {
    send: (symbols) => seamRpc('set_draft_queue', { p_league_id: leagueId, p_symbols: symbols }),
    onStored: onSaved,
  };
  // One machine per league (a remount, or the lobby and the room together, never make two writers).
  const machine = useMemo(() => attachQueueAutosave(leagueId, baseline, drafted, handlers), [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps
  machine.setHandlers(handlers);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // A change the SERVER made (a pick pruned the queue, a re-read, a save landing) moves the list in this render:
  // never an edit, so it saves nothing and never shows the failure line.
  const seen = useRef({ baselineKey, draftedKey });
  const notify = useRef(false);
  if (seen.current.baselineKey !== baselineKey || seen.current.draftedKey !== draftedKey) {
    seen.current = { baselineKey, draftedKey };
    if (machine.rebase(baseline, drafted)) notify.current = true;
  }
  useEffect(() => {
    if (!notify.current) return;
    notify.current = false;
    machine.notify();
  });
  useEffect(() => {
    const off = machine.subscribe(rerender);
    return () => {
      off();
      machine.flush();
    };
  }, [machine]);
  // The app leaving the foreground saves at once whatever is still waiting.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') machine.flush();
    });
    return () => sub.remove();
  }, [machine]);
  const view = machine.snapshot();
  const queue = view.list;
  const edit = (f: (q: string[]) => string[]) => machine.edit(f(machine.snapshot().list));
  const [search, setSearch] = useState('');
  // The company and the draft search's price for every queued stock, read when the card opens (and for a stock added later).
  const { names, prices } = useQueueQuotes(queue);
  const closedLine = useQueueMarketLine();

  // DEV capture only (EXPO_PUBLIC_CAPTURE_SCRIPT, "queueadd:NVDA@4000"): the same add a search result's tap makes.
  useCaptureAction('queueadd', (sym) => {
    if (sym) edit((q) => addSymbol(q, sym));
  });

  const onSelect = (r: ShapedSearchResult) => {
    if (!r.selectable) return;
    edit((q) => addSymbol(q, r.symbol));
    setSearch('');
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
            onMove={(delta) => edit((q) => moveItem(q, i, delta))}
            onRemove={() => edit((q) => removeItem(q, i))}
          />
        ))}
      </View>
      {queue.length < QUEUE_MAX ? (
        <SymbolSearchField value={search} onChangeText={setSearch} onSelect={onSelect} selectedSymbol="" ownedSymbols={NO_OWNED_SYMBOLS} captureAction="typeq" clearOnSelect />
      ) : null}
      {/* Board #call-queue-save, B when a save fails: the app's existing line in place, then Try again. The list
          above stays exactly as you left it; a secondary pill, so the room's one primary stays Draft. */}
      {view.failure ? (
        <View style={styles.failed}>
          <WarnPanel text={view.failure} />
          <Button label="Try again" variant="secondary" onPress={() => machine.retry()} disabled={view.status === 'saving'} status={view.status === 'saving' ? 'loading' : 'idle'} fullWidth />
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
  failed: { marginTop: space[2], gap: space[2] },
});
