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
import {
  queueEditorKey,
  queueStateFor,
  queueStateOnRead,
  queueStateOnSaved,
  queueStateStart,
  type QueueRead,
  type QueueState,
} from './draftQueueRead';

export function useDraftQueue(
  leagueId: string | null,
): QueueRead & { editorKey: string; refresh: () => void; saved: (symbols: string[]) => void } {
  const [stored, setState] = useState<QueueState>(() => queueStateStart(leagueId));
  // The state belongs to one league: after a switch it reads as loading in
  // this very render, never as the last league's list (draftQueueRead.ts).
  const state = queueStateFor(stored, leagueId);
  // The re-read request. It re-runs the effect (which also cancels any read
  // still in flight, so a pre-save read can't land after a save); it is NOT the
  // editor's key.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  // The editor's save went through: adopt the stored list now, then re-read.
  const saved = useCallback((symbols: string[]) => {
    setState((s) => queueStateOnSaved(s, leagueId, symbols));
    setVersion((v) => v + 1);
  }, [leagueId]);

  useEffect(() => {
    // Commit the league's own state before any read of it lands.
    setState((prev) => queueStateFor(prev, leagueId));
    if (!leagueId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await seamTable<{ symbol: string; position: number }>('draft_queue', () =>
          supabase.from('draft_queue').select('symbol, position').eq('league_id', leagueId).order('position'),
        );
        if (!cancelled) setState((prev) => queueStateOnRead(prev, leagueId, res));
      } catch (err) {
        if (cancelled) return;
        console.warn('[game:draft-queue] failed', (err as Error)?.message);
        setState((prev) => queueStateOnRead(prev, leagueId, { data: null, error: err }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId, version]);

  return { ...state.read, editorKey: queueEditorKey(state), refresh, saved };
}
