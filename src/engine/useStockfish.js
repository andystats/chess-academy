import { useEffect, useRef, useState, useCallback } from 'react';
import { createStockfish } from './stockfishClient.js';
import { levelConfig } from './levels.js';

// Owns one Stockfish worker for the lifetime of the mounted play surface. The worker is created
// lazily on the first move request (so a page that never plays never downloads/spawns the engine)
// and terminated on unmount. Strength is remembered and re-applied across requests.
//
// `requestMove` resolves to a UCI move string (or null for "no legal move"); on engine failure it
// surfaces the error via the `error` state and rejects, so callers can keep the board playable.
export function useStockfish(initialStrength = 10) {
  const engineRef = useRef(null);
  const strengthRef = useRef(initialStrength);
  const mountedRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // Tear down the worker when the play surface unmounts.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      const engine = createStockfish();
      try {
        await engine.init();
      } catch (err) {
        // Tear the dead worker down and leave the ref null so a later request can retry cleanly
        // (otherwise every subsequent move would be sent to an engine that never handshook).
        engine.dispose();
        throw err;
      }
      engine.setStrength(levelConfig(strengthRef.current).skill);
      engineRef.current = engine;
      if (mountedRef.current) {
        setReady(true);
        setError(null); // a prior failure recovered on retry — clear the stale error banner
      }
    }
    return engineRef.current;
  }, []);

  const setStrength = useCallback((level) => {
    strengthRef.current = level;
    engineRef.current?.setStrength(levelConfig(level).skill);
  }, []);

  // Abandon the current computation. Only tears the worker down if it's mid-search, so an idle
  // engine survives a reset; the next request lazily rebuilds. Dropping the worker (rather than
  // sending UCI `stop`) avoids a stale `bestmove` racing the next position.
  const interrupt = useCallback(() => {
    if (engineRef.current?.isBusy()) {
      engineRef.current.dispose();
      engineRef.current = null;
      if (mountedRef.current) setReady(false);
    }
  }, []);

  const requestMove = useCallback(
    async (fen, options) => {
      try {
        const engine = await ensureEngine();
        return await engine.getBestMove(fen, options);
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [ensureEngine],
  );

  return { ready, error, requestMove, setStrength, interrupt };
}
