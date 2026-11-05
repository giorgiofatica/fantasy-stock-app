/**
 * useDraftQueue (3c-2): my draft queue, for the pre-draft lobby. Seamed like
 * useDraftRoom's own queue read (fixture rows under the dev seam). See
 * draftQueueRead.ts for why a failed read is never an empty queue, and why
 * the editor's key is `editorKey` (the loaded data's generation), never the
 * re-read request.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { seamTable } from './seamCalls';
import { QUEUE_STATE_START, queueStateOnRead, queueStateOnSaved, type QueueRead, type QueueState } from './draftQueueRead';

export function useDraftQueue(
  leagueId: string | null,
): QueueRead & { editorKey: number; refresh: () => void; saved: (symbols: string[]) => void } {
  const [state, setState] = useState<QueueState>(QUEUE_STATE_START);
  // The re-read request. It re-runs the effect (which also cancels any read
  // still in flight, so a pre-save read can't land after a save); it is NOT the
  // editor's key.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  // The editor's save went through: adopt the stored list now, then re-read.
  const saved = useCallback((symbols: string[]) => {
    setState((s) => queueStateOnSaved(s, symbols));
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await seamTable<{ symbol: string; position: number }>('draft_queue', () =>
          supabase.from('draft_queue').select('symbol, position').eq('league_id', leagueId).order('position'),
        );
        if (!cancelled) setState((prev) => queueStateOnRead(prev, res));
      } catch (err) {
        if (cancelled) return;
        console.warn('[game:draft-queue] failed', (err as Error)?.message);
        setState((prev) => queueStateOnRead(prev, { data: null, error: err }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId, version]);

  return { ...state.read, editorKey: state.generation, refresh, saved };
}
