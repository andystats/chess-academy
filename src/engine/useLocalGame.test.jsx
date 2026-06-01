import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalGame } from './useLocalGame.js';

describe('useLocalGame', () => {
  it('alternates turns after legal moves', () => {
    const { result } = renderHook(() => useLocalGame());
    expect(result.current.currentTurn).toBe('white');

    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    expect(result.current.currentTurn).toBe('black');
    expect(result.current.history).toEqual(['e4']);

    act(() => {
      result.current.onPieceDrop('e7', 'e5');
    });
    expect(result.current.currentTurn).toBe('white');
    expect(result.current.history).toEqual(['e4', 'e5']);
  });

  it('rejects moving the wrong side and can take back one move', () => {
    const { result } = renderHook(() => useLocalGame());

    act(() => {
      result.current.onPieceDrop('e7', 'e5');
    });
    expect(result.current.history).toEqual([]);

    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    act(() => {
      result.current.takeBack();
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.currentTurn).toBe('white');
  });
});
