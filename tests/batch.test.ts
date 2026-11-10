import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BATCH_DRAFT_LENGTH, MAX_BATCH_TASKS, parseBatchDraft } from '../src/features/tasks/batch';
import { STORAGE_KEY, STORAGE_VERSION, type BatchAddResult } from '../src/features/tasks/model';
import { useTasks } from '../src/features/tasks/useTasks';

beforeEach(() => window.localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('parseBatchDraft', () => {
  it('normalizes list and checkbox markers while retaining source line numbers', () => {
    const preview = parseBatchDraft('\n - [ ] Первая\n- [x] Вторая\r\n* Третья\n• Четвёртая\n1. Пятая\n2) Шестая\n\n- [ ]\n-');

    expect(preview).toEqual({
      lines: ['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Пятая', 'Шестая'].map((title, index) => ({ lineNumber: index + 2, title, error: null })),
      total: 6, tooLarge: false, tooMany: false, valid: true,
    });
  });

  it('ignores blank and marker-only lines', () => {
    expect(parseBatchDraft('\n \n- \n* \n• \n1. \n2) \n- [ ]\n- [x]')).toEqual({
      lines: [], total: 0, tooLarge: false, tooMany: false, valid: false,
    });
  });

  it('preserves duplicate titles, internal spaces and Unicode', () => {
    const preview = parseBatchDraft('  Проверить  отчёт 📝  \nПроверить  отчёт 📝');

    expect(preview.lines.map((line) => line.title)).toEqual(['Проверить  отчёт 📝', 'Проверить  отчёт 📝']);
    expect(preview.valid).toBe(true);
  });

  it('reports an invalid line without making the whole draft partially addable', () => {
    const preview = parseBatchDraft(`Хорошая задача\n${'я'.repeat(201)}`);

    expect(preview.total).toBe(2);
    expect(preview.valid).toBe(false);
    expect(preview.lines.map((line) => line.error)).toEqual([null, 'too-long']);
    expect(preview.lines[1]?.lineNumber).toBe(2);
  });

  it.each([50, 51])('limits preview rendering while counting all %i tasks', (count) => {
    const preview = parseBatchDraft(Array.from({ length: count }, (_, index) => `Задача ${index + 1}`).join('\n'));

    expect(MAX_BATCH_TASKS).toBe(50);
    expect(preview.total).toBe(count);
    expect(preview.lines).toHaveLength(Math.min(count, MAX_BATCH_TASKS));
    expect(preview.tooMany).toBe(count > MAX_BATCH_TASKS);
    expect(preview.valid).toBe(count <= MAX_BATCH_TASKS);
  });

  it('uses the same 200 UTF-16 limit for emoji as single-task input', () => {
    expect(parseBatchDraft('📝'.repeat(100)).valid).toBe(true);
    expect(parseBatchDraft(`${'📝'.repeat(100)}а`).lines[0]?.error).toBe('too-long');
  });

  it('rejects an oversized clipboard draft before building any preview', () => {
    const preview = parseBatchDraft(`Допустимая задача\n${' '.repeat(MAX_BATCH_DRAFT_LENGTH)}`);
    expect(preview).toMatchObject({ tooLarge: true, valid: false, lines: [] });
  });
});

describe('addTasks', () => {
  it('adds an ordered batch atomically with one save and fresh unfinished IDs', () => {
    const old = { id: 'old', title: 'Ранее сохранённая', completed: true };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, tasks: [old] }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useTasks(), { wrapper: StrictMode });
    let added: BatchAddResult | undefined;

    act(() => { added = result.current.addTasks(['  Первая  ', 'Вторая', 'Первая']); });

    expect(added).toEqual({ ok: true, count: 3 });
    expect(result.current.tasks.map((task) => task.title)).toEqual(['Первая', 'Вторая', 'Первая', old.title]);
    expect(result.current.tasks.slice(0, 3).map((task) => task.completed)).toEqual([false, false, false]);
    expect(new Set(result.current.tasks.map((task) => task.id)).size).toBe(4);
    expect(result.current.tasks[3]).toEqual(old);
    expect(setItem).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY, expect.any(String));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });
  });

  it.each([
    { titles: [] as string[], error: 'empty' },
    { titles: Array.from({ length: 51 }, (_, index) => String(index)), error: 'too-many' },
    { titles: ['Допустимая', '   '], error: 'invalid' },
    { titles: ['Допустимая', 'я'.repeat(201)], error: 'invalid' },
  ])('rejects $error before generating UUIDs, mutating or saving', ({ titles, error }) => {
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useTasks());
    let added: BatchAddResult | undefined;

    act(() => { added = result.current.addTasks(titles); });

    expect(added).toEqual({ ok: false, error });
    expect(result.current.tasks).toEqual([]);
    expect(uuid).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('composes a batch with other operations from the same render', () => {
    const { result } = renderHook(() => useTasks());
    const controller = result.current;

    act(() => { controller.addTask('Сначала'); controller.addTasks(['A', 'B']); controller.addTask('Последняя'); });

    expect(result.current.tasks.map((task) => task.title)).toEqual(['Последняя', 'A', 'B', 'Сначала']);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).tasks).toEqual(result.current.tasks);
  });
});
