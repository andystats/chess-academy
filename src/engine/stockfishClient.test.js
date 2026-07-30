import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStockfish } from './stockfishClient.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

class FakeWorker {
  static instances = [];

  static holdFirstAnalysis = false;

  static holdStartup = false;

  constructor(url) {
    this.url = url;
    this.commands = [];
    this.analysisSearches = 0;
    this.heldSearch = false;
    this.terminated = false;
    FakeWorker.instances.push(this);
  }

  emit(line) {
    queueMicrotask(() => this.onmessage?.({ data: line }));
  }

  emitAnalysis() {
    [
      'info depth 1 seldepth 2 multipv 1 score cp 30 nodes 100 nps 10000 time 10 pv e2e4 e7e5',
      'info depth 1 seldepth 2 multipv 2 score cp 20 nodes 100 nps 10000 time 10 pv d2d4 d7d5',
      'info depth 1 seldepth 3 multipv 3 score cp 10 nodes 100 nps 10000 time 10 pv g1f3 g8f6',
      'info depth 2 seldepth 4 multipv 1 score cp 35 nodes 250 nps 12500 time 20 pv e2e4 e7e5',
      'info depth 2 seldepth 3 multipv 2 score cp 22 lowerbound nodes 250 nps 12500 time 20 pv d2d4 d7d5',
      'info depth 2 seldepth 3 multipv 3 score mate 7 nodes 250 nps 12500 time 20 pv g1f3 g8f6',
      'bestmove e2e4 ponder e7e5',
    ].forEach((line) => this.emit(line));
  }

  postMessage(command) {
    this.commands.push(command);
    if (command === 'uci') {
      if (!FakeWorker.holdStartup) this.emit('uciok');
    } else if (command === 'isready') {
      this.emit('readyok');
    } else if (command === 'eval') {
      this.emit('Material | ---- ---- | ---- ---- | 0.50 0.75');
      this.emit('Mobility | 0.20 0.10 | 0.10 0.05 | 0.10 0.05');
      this.emit('Total | ---- ---- | ---- ---- | 0.60 0.80');
      this.emit('Total evaluation: 0.70 (white side)');
    } else if (command.startsWith('go movetime')) {
      this.emit('info depth 3 score cp 25 pv e2e4');
      this.emit('bestmove e2e4');
    } else if (command.startsWith('go depth')) {
      this.analysisSearches += 1;
      if (FakeWorker.holdFirstAnalysis && this.analysisSearches === 1) {
        this.heldSearch = true;
      } else {
        this.emitAnalysis();
      }
    } else if (command === 'stop' && this.heldSearch) {
      this.heldSearch = false;
      this.emit('bestmove e2e4');
    }
  }

  terminate() {
    this.terminated = true;
  }
}

async function until(predicate) {
  for (let i = 0; i < 20; i += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Condition did not become true.');
}

beforeEach(() => {
  FakeWorker.instances = [];
  FakeWorker.holdFirstAnalysis = false;
  FakeWorker.holdStartup = false;
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createStockfish', () => {
  it('preserves the gameplay best-move contract', async () => {
    const client = createStockfish();
    const result = await client.getBestMove(START, { movetime: 10 });

    expect(result).toEqual({
      move: 'e2e4',
      evaluation: { type: 'cp', white: 25 },
    });
    expect(FakeWorker.instances[0].commands).toContain('go movetime 10');
    client.dispose();
  });

  it('returns full-strength MultiPV snapshots, SAN, and classical evaluation', async () => {
    const client = createStockfish();
    client.setStrength(4);
    const onSnapshot = vi.fn();
    const onStaticEvaluation = vi.fn();
    const result = await client.analyze(START, {
      depth: 2,
      learnerSide: 'black',
      onSnapshot,
      onStaticEvaluation,
    });

    expect(result.bestMove).toBe('e2e4');
    expect(result.learnerSide).toBe('black');
    expect(result.depthSnapshots).toHaveLength(2);
    expect(result.depthSnapshots[1]).toMatchObject({
      depth: 2,
      selectiveDepth: 4,
      nodes: 250,
      nps: 12500,
      elapsedMs: 20,
      lines: [
        {
          rank: 1,
          score: -35,
          mate: null,
          bound: 'exact',
          uciMoves: ['e2e4', 'e7e5'],
          sanMoves: ['e4', 'e5'],
        },
        {
          rank: 2,
          score: -22,
          mate: null,
          bound: 'upper',
        },
        {
          rank: 3,
          score: null,
          mate: -7,
        },
      ],
    });
    expect(result.staticEvaluation.material.advantage).toEqual({
      middleGame: -0.5,
      endgame: -0.75,
    });
    expect(result.staticEvaluation.total.finalAdvantage).toBe(-0.7);
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(onStaticEvaluation).toHaveBeenCalledWith(result.staticEvaluation);

    const commands = FakeWorker.instances[0].commands;
    expect(commands).toContain('setoption name Skill Level value 20');
    expect(commands).toContain('setoption name UCI_AnalyseMode value true');
    expect(commands).toContain('setoption name MultiPV value 3');
    expect(commands).toContain('go depth 2');
    expect(commands.slice(-3)).toEqual([
      'setoption name UCI_AnalyseMode value false',
      'setoption name MultiPV value 1',
      'setoption name Skill Level value 4',
    ]);
    client.dispose();
  });

  it('stops an aborted search, drains it, and then runs the next queued analysis', async () => {
    FakeWorker.holdFirstAnalysis = true;
    const client = createStockfish();
    const controller = new AbortController();
    const first = client.analyze(START, { depth: 2, signal: controller.signal }).catch((error) => error);
    const second = client.analyze(START, { depth: 2 });

    await until(() => FakeWorker.instances.length === 1);
    const worker = FakeWorker.instances[0];
    await until(() => worker.commands.includes('go depth 2'));
    controller.abort();
    const firstError = await first;
    const secondResult = await second;

    expect(firstError).toMatchObject({ name: 'AbortError', isInterrupt: true });
    expect(secondResult.depthSnapshots).toHaveLength(2);
    expect(worker.commands.filter((command) => command === 'go depth 2')).toHaveLength(2);
    const stopIndex = worker.commands.indexOf('stop');
    const secondSearchIndex = worker.commands.lastIndexOf('go depth 2');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(secondSearchIndex).toBeGreaterThan(stopIndex);
    client.dispose();
  });

  it('cancels a slow startup by disposing the incomplete worker', async () => {
    FakeWorker.holdStartup = true;
    const client = createStockfish();
    const controller = new AbortController();
    const pending = client
      .analyze(START, { signal: controller.signal })
      .catch((error) => error);

    await until(() => FakeWorker.instances[0]?.commands.includes('uci'));
    controller.abort();
    const error = await pending;

    expect(error).toMatchObject({ name: 'AbortError', isInterrupt: true });
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });
});
