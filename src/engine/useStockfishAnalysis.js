import { useCallback, useEffect, useRef, useState } from 'react';
import { createStockfish } from './stockfishClient.js';
import {
  ANALYSIS_DEFAULT_DEPTH,
  ANALYSIS_MULTI_PV,
  normalizeAnalysisDepth,
  sideToMove,
} from './analysisModel.js';

const SESSION_CACHE_LIMIT = 24;
const sessionAnalysisCache = new Map();

function emptyState(fen = '') {
  return {
    fen,
    status: 'idle',
    learnerSide: null,
    depthSnapshots: [],
    staticEvaluation: null,
    bestMove: null,
    error: null,
    cached: false,
  };
}

function cacheKey(fen, learnerSide, depth) {
  return `stockfish10|${fen}|${learnerSide}|d${depth}|pv${ANALYSIS_MULTI_PV}`;
}

function cacheResult(key, result) {
  if (sessionAnalysisCache.has(key)) sessionAnalysisCache.delete(key);
  sessionAnalysisCache.set(key, result);
  while (sessionAnalysisCache.size > SESSION_CACHE_LIMIT) {
    sessionAnalysisCache.delete(sessionAnalysisCache.keys().next().value);
  }
}

export function clearStockfishAnalysisCache() {
  sessionAnalysisCache.clear();
}

/**
 * Lazily analyze `fen` when enabled. The hook owns a dedicated full-strength worker, guards every
 * progressive/final write with a run id, and caches completed results for the current app session.
 */
export function useStockfishAnalysis({
  fen = '',
  learnerSide = null,
  depth = ANALYSIS_DEFAULT_DEPTH,
  enabled = true,
} = {}) {
  const requestedFen = typeof fen === 'string' ? fen.trim() : '';
  const safeDepth = normalizeAnalysisDepth(depth);
  const engineRef = useRef(null);
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const currentKeyRef = useRef(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState(() => emptyState(requestedFen));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    controllerRef.current?.abort();
    controllerRef.current = null;
    currentKeyRef.current = null;

    if (!enabled || !requestedFen) {
      setState(emptyState(requestedFen));
      return undefined;
    }

    let perspective;
    try {
      const positionSide = sideToMove(requestedFen); // validates the FEN before loading a worker
      perspective = learnerSide ?? positionSide;
      if (perspective !== 'white' && perspective !== 'black') {
        throw new Error('learnerSide must be "white" or "black".');
      }
    } catch (error) {
      setState({
        ...emptyState(requestedFen),
        status: 'error',
        error,
      });
      return undefined;
    }

    const key = cacheKey(requestedFen, perspective, safeDepth);
    currentKeyRef.current = key;
    const cached = sessionAnalysisCache.get(key);
    if (cached) {
      setState({ ...cached, status: 'complete', error: null, cached: true });
      return undefined;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({
      ...emptyState(requestedFen),
      learnerSide: perspective,
      status: 'loading',
    });

    const isCurrent = () =>
      mountedRef.current && runId === runIdRef.current && !controller.signal.aborted;

    async function run() {
      try {
        if (!engineRef.current) engineRef.current = createStockfish();
        const result = await engineRef.current.analyze(requestedFen, {
          depth: safeDepth,
          learnerSide: perspective,
          signal: controller.signal,
          onReady: () => {
            if (!isCurrent()) return;
            setState((current) => ({ ...current, status: 'searching' }));
          },
          onStaticEvaluation: (staticEvaluation) => {
            if (!isCurrent()) return;
            setState((current) => ({ ...current, staticEvaluation, status: 'searching' }));
          },
          onSnapshot: (snapshot) => {
            if (!isCurrent()) return;
            setState((current) => {
              const byDepth = new Map(
                current.depthSnapshots.map((existing) => [existing.depth, existing]),
              );
              byDepth.set(snapshot.depth, snapshot);
              return {
                ...current,
                status: 'searching',
                depthSnapshots: [...byDepth.values()].sort((a, b) => a.depth - b.depth),
              };
            });
          },
        });
        if (!isCurrent()) return;
        cacheResult(key, result);
        setState({ ...result, status: 'complete', error: null, cached: false });
      } catch (error) {
        if (!isCurrent() || error?.name === 'AbortError' || error?.isInterrupt) return;
        engineRef.current?.dispose();
        engineRef.current = null;
        setState({
          ...emptyState(requestedFen),
          learnerSide: perspective,
          status: 'error',
          error,
        });
      }
    }

    run();
    return () => {
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [requestedFen, learnerSide, safeDepth, enabled, retryNonce]);

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (mountedRef.current) {
      setState((current) => ({ ...current, status: 'idle', error: null }));
    }
  }, []);

  const retry = useCallback(() => {
    if (currentKeyRef.current) sessionAnalysisCache.delete(currentKeyRef.current);
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  return { ...state, cancel, retry };
}
