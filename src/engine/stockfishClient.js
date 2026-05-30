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

const HANDSHAKE_TIMEOUT_MS = 10000;
const MOVE_TIMEOUT_MS = 20000;

// Where the vendored worker + wasm live. BASE_URL already encodes the GitHub Pages "/<repo>/" prefix.
function workerUrl() {
  const base = import.meta.env.BASE_URL;
  const file = typeof WebAssembly === 'object' ? 'stockfish.wasm.js' : 'stockfish.js';
  return `${base}engine/${file}`;
}

export function createStockfish() {
  let worker = null;
  let pending = null; // { match, resolve, reject, timer } for the one outstanding command, or null

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
  function waitFor(match, timeoutMs, label) {
    if (pending) return Promise.reject(new Error('Stockfish is already handling a command.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => settle(new Error(`Stockfish timed out waiting for ${label}.`)),
        timeoutMs,
      );
      pending = { match, resolve, reject, timer };
    });
  }

  function handleLine(line) {
    if (!pending) return;
    const hit = pending.match(line);
    if (hit === false || hit === undefined) return; // not the line we're waiting for
    settle(null, hit);
  }

  function send(command) {
    if (worker) worker.postMessage(command);
  }

  async function init() {
    if (worker) return;
    worker = new Worker(workerUrl());
    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data;
      if (typeof line === 'string') handleLine(line);
    };
    worker.onerror = () => settle(new Error('The chess engine failed to load.'));
    send('uci');
    await waitFor((l) => l === 'uciok' || undefined, HANDSHAKE_TIMEOUT_MS, 'engine startup');
    send('isready');
    await waitFor((l) => l === 'readyok' || undefined, HANDSHAKE_TIMEOUT_MS, 'engine readiness');
  }

  // Skill Level (0–20) is Stockfish's built-in strength dial; lower plays weaker and faster.
  function setStrength(level) {
    const clamped = Math.max(0, Math.min(20, Math.round(level)));
    send(`setoption name Skill Level value ${clamped}`);
  }

  // Ask for the best move from `fen`. Limit by `depth` (weak, shallow search) when given, else by
  // `movetime` ms. Resolves to a UCI move ("e2e4", "a7a8q"), or null if the engine reports no legal
  // move ("bestmove (none)").
  async function getBestMove(fen, { depth, movetime = 800 } = {}) {
    if (!worker) await init();
    send(`position fen ${fen}`);
    send(depth ? `go depth ${depth}` : `go movetime ${Math.round(movetime)}`);
    const line = await waitFor((l) => (l.startsWith('bestmove') ? l : false), MOVE_TIMEOUT_MS, 'a move');
    const uci = line.split(/\s+/)[1];
    return isUci(uci) ? uci : null;
  }

  // True while a command is outstanding — lets the caller decide to tear down a thinking engine on
  // reset rather than start an overlapping command (which waitFor would reject).
  function isBusy() {
    return pending !== null;
  }

  function dispose() {
    settle(new Error('The chess engine was stopped.'));
    if (worker) {
      try {
        worker.postMessage('quit');
      } catch {
        // worker may already be gone
      }
      worker.terminate();
      worker = null;
    }
  }

  return { init, setStrength, getBestMove, isBusy, dispose };
}
