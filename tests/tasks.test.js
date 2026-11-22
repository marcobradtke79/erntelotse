import { describe, test, expect } from './harness.js';
import {
  stateOf, overdueHints, journalEntryForHint, createJournalEntry, harvestTotals, filterJournal, validateJournalEntry, validateTaskStates,
} from '../js/logic/tasks.js';
import { formatWeight } from '../js/logic/units.js';

const hint = (key, start, end, type = 'fertilize') => ({ key, type, plantId: 'tomato', sourceId: 'p_1', sourceKind: 'planting', start, end });

describe('task states', () => {
  test('open unless decided', () => {
    expect(stateOf(hint('a', '2026-06-01', '2026-06-07'), {})).toBe('open');
    expect(stateOf(hint('a', '2026-06-01', '2026-06-07'), { a: { state: 'done', on: '2026-06-02' } })).toBe('done');
  });
  test('overdue: open, ended, not older than 30 days', () => {
    const hints = [hint('old', '2026-04-01', '2026-04-07'), hint('recent', '2026-05-20', '2026-05-26'), hint('done', '2026-05-20', '2026-05-26'), hint('now', '2026-06-01', '2026-06-20')];
    const overdue = overdueHints(hints, { done: { state: 'done', on: '2026-05-21' } }, '2026-06-10');
    expect(overdue.map((h) => h.key)).toEqual(['recent']);
  });
  test('validation of task states', () => {
    expect(validateTaskStates({ a: { state: 'done', on: '2026-06-02' }, b: { state: 'maybe', on: '2026-06-02' }, c: null })).toEqual(['b', 'c']);
  });
});

describe('journal', () => {
  test('entry from a done task keeps the task key', () => {
    const entry = journalEntryForHint(hint('k1', '2026-06-01', '2026-06-07', 'harvest'), '2026-06-03');
    expect(entry.taskKey).toBe('k1');
    expect(entry.type).toBe('harvest');
    expect(validateJournalEntry(entry)).toEqual([]);
  });
  test('harvest totals per plant and year', () => {
    const journal = [
      createJournalEntry({ date: '2026-08-01', type: 'harvest', plantId: 'tomato', amountKg: 1.5 }),
      createJournalEntry({ date: '2026-08-15', type: 'harvest', plantId: 'tomato', amountKg: 3 }),
      createJournalEntry({ date: '2026-07-01', type: 'harvest', plantId: 'zucchini', amountKg: 6 }),
      createJournalEntry({ date: '2025-08-01', type: 'harvest', plantId: 'tomato', amountKg: 9 }),
      createJournalEntry({ date: '2026-08-02', type: 'water', plantId: 'tomato' }),
    ];
    expect(harvestTotals(journal, 2026)).toEqual([{ plantId: 'zucchini', kg: 6, entries: 1 }, { plantId: 'tomato', kg: 4.5, entries: 2 }]);
  });
  test('4.5 kg in imperial units (acceptance)', () => {
    expect(formatWeight(4.5, 'imperial', 'en')).toBe('9 lb 15 oz');
  });
  test('filter by year, type, plant and place; newest first', () => {
    const journal = [
      createJournalEntry({ date: '2026-05-01', type: 'sow', plantId: 'carrot', sourceId: 'p_a' }),
      createJournalEntry({ date: '2026-07-01', type: 'harvest', plantId: 'carrot', sourceId: 'p_a' }),
      createJournalEntry({ date: '2026-06-01', type: 'harvest', plantId: 'tomato', sourceId: 'p_b' }),
      createJournalEntry({ date: '2025-06-01', type: 'harvest', plantId: 'tomato', sourceId: 'p_b' }),
    ];
    expect(filterJournal(journal, { year: 2026 }).map((e) => e.date)).toEqual(['2026-07-01', '2026-06-01', '2026-05-01']);
    expect(filterJournal(journal, { year: 2026, type: 'harvest', plantId: 'carrot' }).length).toBe(1);
    const bedOf = (entry) => (entry.sourceId === 'p_a' ? 'e_bed1' : 'e_bed2');
    expect(filterJournal(journal, { sourceId: 'e_bed2', bedOf }).length).toBe(2);
  });
  test('validation', () => {
    expect(validateJournalEntry({ date: '2026-13-01', type: 'dance', amountKg: -1, note: 5 })).toEqual(['date', 'type', 'amountKg', 'note']);
  });
});
