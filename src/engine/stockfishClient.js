// A thin promise-based client over the Stockfish WASM engine, which runs as a Web Worker and
// speaks the UCI text protocol. The worker file is vendored under public/engine/ by
// scripts/vendor-engine.mjs (see THIRD_PARTY.md); we load it as a classic worker.
//
// Design / correctness choices:
//  - We use the single-threaded build (stockfish.wasm.js), which needs no SharedArrayBuffer and so
//    runs on GitHub Pages without COOP/COEP headers. The .wasm sits beside the worker script and is
//    fetched relative to the worker's own URL, so the GitHub Pages base path resolves automatically.
//  - UCI is line-oriented and we drive it strictly sequentially (one outstanding request at a time),
//    so a single pending resolver is enough; a worker error or dispose rejects anything in flight.
//  - The engine speaks via plain strings posted from the worker; we never eval its output.

import { isUci } from '../lesson/moves.js';
import { parseClassicalEvalTrace, parseUciInfo } from './analysisParsers.js';
import {
  ANALYSIS_DEFAULT_DEPTH,
  ANALYSIS_MULTI_PV,
  createDepthSnapshotCollector,
  normalizeClassicalEvaluation,
  normalizeAnalysisDepth,
} from './analysisModel.js';

const HANDSHAKE_TIMEOUT_MS = 10000;
const MOVE_TIMEOUT_MS = 20000;
const ANALYSIS_TIMEOUT_MS = 30000;

// Where the vendored worker + wasm live. BASE_URL already encodes the GitHub Pages "/<repo>/" prefix.
function workerUrl() {
  const base = import.meta.env.BASE_URL;
  const file = typeof WebAssembly === 'object' ? 'stockfish.wasm.js' : 'stockfish.js';
  return `${base}engine/${file}`;
}

export function createStockfish() {
  let worker = null;
  let pending = null; // { match, resolve, reject, timer } for the one outstanding command, or null
  let lastScore = null;
  let searching = false; // capture score lines only while a bestmove is pending
  let configuredStrength = 20;
  let analysisQueue = Promise.resolve();
  let initPromise = null;

  function settle(error, value) {
    if (!pending) return;
    const p = pending;
    pending = null;
    clearTimeout(p.timer);
    if (error) p.reject(error);
    else p.resolve(value);
  }

  // Resolve once the engine emits a line satisfying `match` (which returns the resolved value, or
  // false/undefined to keep waiting); reject on timeout, dispose, or worker error. UCI is driven
  // strictly one command at a time, so a second wait while one is pending is a caller bug — reject
  // it rather than silently orphan the first request's resolver.
  function waitFor(match, timeoutMs, label, onLine = null) {
    if (pending) return Promise.reject(new Error('Stockfish is already handling a command.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => settle(new Error(`Stockfish timed out waiting for ${label}.`)),
        timeoutMs,
      );
      pending = { match, resolve, reject, timer, onLine };
    });
  }

  function handleLine(line) {
    const info = parseUciInfo(line);
    if (info?.score && searching) lastScore = info.score; // ignore stray info outside a search
    if (!pending) return;
    try {
      pending.onLine?.(line);
    } catch (error) {
      settle(error);
      return;
    }
    const hit = pending.match(line);
    if (hit === false || hit === undefined) return; // not the line we're waiting for
    settle(null, hit);
  }

  function send(command) {
    if (worker) worker.postMessage(command);
  }

  async function init() {
    if (initPromise) return initPromise;
    if (worker) return;
    worker = new Worker(workerUrl());
    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data;
      if (typeof line === 'string') handleLine(line);
    };
    worker.onerror = () => settle(new Error('The chess engine failed to load.'));
    const starting = (async () => {
      const uciReady = waitFor(
        (line) => line === 'uciok' || undefined,
        HANDSHAKE_TIMEOUT_MS,
        'engine startup',
      );
      send('uci');
      await uciReady;
      const engineReady = waitFor(
        (line) => line === 'readyok' || undefined,
        HANDSHAKE_TIMEOUT_MS,
        'engine readiness',
      );
      send('isready');
      await engineReady;
    })();
    initPromise = starting;
    try {
      await starting;
    } finally {
      if (initPromise === starting) initPromise = null;
    }
  }

  // Skill Level (0–20) is Stockfish's built-in strength dial; lower plays weaker and faster.
  function setStrength(level) {
    const clamped = Math.max(0, Math.min(20, Math.round(level)));
    configuredStrength = clamped;
    send(`setoption name Skill Level value ${clamped}`);
  }

  // Ask for the best move from `fen`. Limit by `depth` (weak, shallow search) when given, else by
  // `movetime` ms. Resolves to the UCI move plus the latest score line Stockfish emitted for this
  // search. Scores are normalized to White's point of view for easier UI display.
  async function getBestMove(fen, { depth, movetime = 800 } = {}) {
    if (!worker) await init();
    lastScore = null;
    send(`position fen ${fen}`);
    searching = true;
    try {
      const bestMove = waitFor(
        (line) => (line.startsWith('bestmove') ? line : false),
        MOVE_TIMEOUT_MS,
        'a move',
      );
      send(depth ? `go depth ${depth}` : `go movetime ${Math.round(movetime)}`);
      const line = await bestMove;
      const uci = line.split(/\s+/)[1];
      return {
        move: isUci(uci) ? uci : null,
        evaluation: normalizeGameplayScore(lastScore, fen),
      };
    } finally {
      searching = false;
    }
  }

  function abortError() {
    const error = new Error('Stockfish analysis was cancelled.');
    error.name = 'AbortError';
    error.isInterrupt = true;
    return error;
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) throw abortError();
  }

  async function initializeAnalysis(signal) {
    throwIfAborted(signal);
    const cancelStartup = () => dispose();
    signal?.addEventListener('abort', cancelStartup, { once: true });
    try {
      await init();
      throwIfAborted(signal);
    } catch (error) {
      if (signal?.aborted) throw abortError();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancelStartup);
    }
  }

  async function readStaticEvaluation(fen, signal) {
    throwIfAborted(signal);
    const lines = [];
    send(`position fen ${fen}`);
    const ready = waitFor(
      (line) => line === 'readyok' || undefined,
      HANDSHAKE_TIMEOUT_MS,
      'the static evaluation',
      (line) => {
        if (line !== 'readyok') lines.push(line);
      },
    );
    const cancelEvaluation = () => dispose();
    signal?.addEventListener('abort', cancelEvaluation, { once: true });
    send('eval');
    send('isready'); // a deterministic delimiter after the multi-line, non-standard eval trace
    try {
      await ready;
      throwIfAborted(signal);
      return parseClassicalEvalTrace(lines);
    } catch (error) {
      if (signal?.aborted) throw abortError();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancelEvaluation);
    }
  }

  async function searchAnalysis(fen, depth, collector, signal) {
    throwIfAborted(signal);
    lastScore = null;
    send(`position fen ${fen}`);
    searching = true;
    const bestMove = waitFor(
      (line) => (line.startsWith('bestmove') ? line : false),
      ANALYSIS_TIMEOUT_MS,
      'analysis',
      (line) => {
        const info = parseUciInfo(line);
        if (info) collector.add(info);
      },
    );
    const stop = () => send('stop');
    signal?.addEventListener('abort', stop, { once: true });
    try {
      send(`go depth ${depth}`);
      const line = await bestMove;
      throwIfAborted(signal);
      const uci = line.split(/\s+/)[1];
      return isUci(uci) ? uci : null;
    } finally {
      signal?.removeEventListener('abort', stop);
      searching = false;
    }
  }

  async function runAnalysis(
    fen,
    {
      depth = ANALYSIS_DEFAULT_DEPTH,
      learnerSide,
      signal,
      onReady,
      onSnapshot,
      onStaticEvaluation,
    } = {},
  ) {
    throwIfAborted(signal);
    const safeDepth = normalizeAnalysisDepth(depth);
    const collector = createDepthSnapshotCollector({ fen, learnerSide, onSnapshot });
    let settingsApplied = false;
    try {
      await initializeAnalysis(signal);
      onReady?.();

      // Analysis is a teacher, not the deliberately weakened opponent used by Arena levels.
      send('setoption name Skill Level value 20');
      send('setoption name UCI_AnalyseMode value true');
      send(`setoption name MultiPV value ${ANALYSIS_MULTI_PV}`);
      settingsApplied = true;

      const parsedEvaluation = await readStaticEvaluation(fen, signal);
      const staticEvaluation = normalizeClassicalEvaluation(
        parsedEvaluation,
        collector.learnerSide,
      );
      onStaticEvaluation?.(staticEvaluation);
      const bestMove = await searchAnalysis(fen, safeDepth, collector, signal);
      return {
        fen,
        learnerSide: collector.learnerSide,
        depthSnapshots: collector.snapshots(),
        staticEvaluation,
        bestMove,
      };
    } catch (error) {
      // A timeout or worker error can leave a late bestmove in the protocol stream. Tear the worker
      // down so a retry starts clean; a normal AbortSignal is drained via `stop` and stays reusable.
      if (error?.name !== 'AbortError' && !error?.isInterrupt) dispose();
      throw error;
    } finally {
      if (settingsApplied) {
        send('setoption name UCI_AnalyseMode value false');
        send('setoption name MultiPV value 1');
        send(`setoption name Skill Level value ${configuredStrength}`);
      }
    }
  }

  /**
   * Analyze one FEN with full-strength Stockfish and three leading PVs. Calls are serialized on this
   * client; aborting an active call sends `stop`, drains its bestmove, and lets the next call begin.
   */
  function analyze(fen, options) {
    const task = analysisQueue.then(() => runAnalysis(fen, options));
    analysisQueue = task.catch(() => undefined);
    return task;
  }

  // True while a command is outstanding — lets the caller decide to tear down a thinking engine on
  // reset rather than start an overlapping command (which waitFor would reject).
  function isBusy() {
    return pending !== null;
  }

  function dispose() {
    const stopped = new Error('The chess engine was stopped.');
    stopped.isInterrupt = true; // an intentional stop (reset/unmount), not an engine failure
    settle(stopped);
    if (worker) {
      try {
        worker.postMessage('quit');
      } catch {
        // worker may already be gone
      }
      worker.terminate();
      worker = null;
    }
    searching = false;
  }

  return { init, setStrength, getBestMove, analyze, isBusy, dispose };
}

function normalizeGameplayScore(score, fen) {
  if (!score) return null;
  const turn = fen.split(/\s+/)[1] === 'b' ? 'black' : 'white';
  const sign = turn === 'white' ? 1 : -1;
  return {
    type: score.type,
    white: score.value * sign,
  };
}
