import { test, expect } from './harness.js';
import { createHistory } from '../js/logic/history.js';

test('undo and redo walk through recorded states', () => {
  const history = createHistory();
  let state = 'a';
  const change = (next) => {
    history.record(state);
    state = next;
  };
  change('b');
  change('c');
  state = history.undo(state);
  expect(state).toBe('b');
  state = history.undo(state);
  expect(state).toBe('a');
  expect(history.undo(state)).toBeNull();
  state = history.redo(state);
  expect(state).toBe('b');
  expect(history.canRedo()).toBeTruthy();
});

test('a new change clears redo', () => {
  const history = createHistory();
  history.record('a');
  history.undo('b');
  history.record('a');
  expect(history.canRedo()).toBeFalsy();
});

test('limit drops the oldest states', () => {
  const history = createHistory(2);
  history.record('a');
  history.record('b');
  history.record('c');
  expect(history.undo('d')).toBe('c');
  expect(history.undo('c')).toBe('b');
  expect(history.undo('b')).toBeNull();
});

test('clear', () => {
  const history = createHistory();
  history.record('a');
  history.clear();
  expect(history.canUndo()).toBeFalsy();
});
