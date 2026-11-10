import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, type Task, type TaskDetails } from '../src/features/tasks/model';
import { formatDueDate, isValidDate, localDateKey, sortTasks } from '../src/features/tasks/planning';
import { loadTasks } from '../src/features/tasks/storage';
import { useTasks } from '../src/features/tasks/useTasks';

const base: Task = { id: 'old', title: 'Прежняя задача', completed: true };
const details: TaskDetails = { title: 'План', important: true, urgency: 'urgent', dueDate: '2028-02-29' };
function seed(tasks: readonly Task[] = [base]) {
  const snapshot = JSON.stringify({ version: 1, tasks });
  localStorage.setItem(STORAGE_KEY, snapshot);
  return snapshot;
}
beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('calendar-only planning', () => {
  it.each(['0001-01-01', '9999-12-31', '2028-02-29', '2000-02-29', '2026-04-30'])('accepts a real canonical day %s', (day) => {
    expect(isValidDate(day)).toBe(true);
  });
  it.each(['0000-01-01', '2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '2026-11-04T00:00:00Z', '', ' 2026-11-04', '2026-11-04\n'])('rejects a malformed or impossible day %s', (day) => {
    expect(isValidDate(day)).toBe(false);
  });
  it('uses local calendar fields at midnight instead of converting the day to UTC', () => {
    const now = new Date(2026, 10, 4, 0, 5);
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw new Error('UTC conversion is forbidden for a calendar day'); });
    expect(localDateKey(now)).toBe('2026-11-04');
    expect(formatDueDate('2026-11-04', false, now)).toEqual({ label: 'Сегодня', overdue: false });
    expect(formatDueDate('2026-11-05', false, now)).toEqual({ label: 'Завтра', overdue: false });
  });
  it('handles tomorrow across a month/year boundary and keeps completed past dates neutral', () => {
    const now = new Date(2026, 11, 31, 23, 55);
    expect(formatDueDate('2027-01-01', false, now)).toEqual({ label: 'Завтра', overdue: false });
    expect(formatDueDate('2026-12-30', false, now)).toEqual({ label: expect.stringMatching(/^Просрочено · 30/), overdue: true });
    expect(formatDueDate('2026-12-30', true, now)).toEqual({ label: expect.stringMatching(/^30/), overdue: false });
    expect(formatDueDate('2026-04-31', false, now)).toEqual({ label: '', overdue: false });
  });
});

describe('compatible storage and atomic planning changes', () => {
  it('loads old v1 tasks exactly and never adds metadata or writes during StrictMode mount', () => {
    seed();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useTasks(), { wrapper: StrictMode });
    expect(result.current.tasks).toEqual([base]);
    expect(result.current.storageStatus).toBe('available');
    expect(write).not.toHaveBeenCalled();
  });
  it('round-trips optional metadata without altering old tasks', () => {
    const planned: Task = { id: 'planned', title: 'Новая', completed: false, important: true, urgency: 'later', dueDate: '2026-11-04' };
    const snapshot = seed([base, planned]);
    expect(loadTasks()).toEqual({ kind: 'ready', tasks: [base, planned], snapshot });
  });
  it.each([
    { important: 'yes' }, { important: null }, { urgency: 'asap' }, { urgency: null },
    { dueDate: '' }, { dueDate: '2026-02-29' }, { dueDate: '2026-11-31' }, { dueDate: null },
  ])('protects storage containing invalid planning metadata %j', (metadata) => {
    const raw = JSON.stringify({ version: 1, tasks: [{ ...base, ...metadata }] });
    localStorage.setItem(STORAGE_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useTasks());
    expect(result.current.storageStatus).toBe('invalid');
    act(() => { result.current.addPlannedTask(details); });
    expect(result.current.tasks).toHaveLength(1);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('adds one planned task in one write only after full validation', () => {
    seed();
    const { result } = renderHook(() => useTasks());
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const uuid = vi.spyOn(crypto, 'randomUUID');
    act(() => {
      expect(result.current.addPlannedTask({ ...details, dueDate: '2026-02-30' })).toEqual({ ok: false, error: 'invalid-date' });
      expect(result.current.addPlannedTask({ ...details, title: ' '.repeat(2) })).toEqual({ ok: false, error: 'empty' });
    });
    expect(write).not.toHaveBeenCalled();
    expect(uuid).not.toHaveBeenCalled();
    act(() => { expect(result.current.addPlannedTask({ ...details, title: '  План  ' })).toEqual({ ok: true }); });
    expect(uuid).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(result.current.tasks).toEqual([
      { id: expect.any(String), title: 'План', completed: false, important: true, urgency: 'urgent', dueDate: '2028-02-29' }, base,
    ]);
    expect(loadTasks()).toEqual({ kind: 'ready', tasks: result.current.tasks, snapshot: localStorage.getItem(STORAGE_KEY) });
  });
  it('rejects untrusted urgency and importance at the controller boundary', () => {
    const { result } = renderHook(() => useTasks());
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => {
      expect(result.current.addPlannedTask({ ...details, urgency: 'ASAP' } as unknown as TaskDetails)).toEqual({ ok: false, error: 'invalid-planning' });
      expect(result.current.addPlannedTask({ ...details, important: 'yes' } as unknown as TaskDetails)).toEqual({ ok: false, error: 'invalid-planning' });
    });
    expect(result.current.tasks).toEqual([]);
    expect(write).not.toHaveBeenCalled();
  });
  it('updates title and planning atomically, preserving identity, status, position and undo history', () => {
    const removed: Task = { id: 'removed', title: 'Вернуть', completed: false, important: true, urgency: 'later', dueDate: '2026-11-05' };
    seed([base, removed]);
    const { result } = renderHook(() => useTasks());
    act(() => result.current.removeTask(removed.id));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => { expect(result.current.updateTaskDetails(base.id, details)).toEqual({ ok: true }); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(result.current.tasks[0]).toEqual({ id: base.id, completed: true, ...details });
    expect(result.current.lastRemovedTask).toEqual(removed);
    act(() => { expect(result.current.undoRemoval()).toBe(true); });
    expect(result.current.tasks[1]).toEqual(removed);
    expect(write).toHaveBeenCalledTimes(2);
    expect(loadTasks()).toEqual({ kind: 'ready', tasks: result.current.tasks, snapshot: localStorage.getItem(STORAGE_KEY) });
  });
  it('keeps a rejected edit unchanged and allows clearing all metadata with one write', () => {
    const planned: Task = { ...base, important: true, urgency: 'urgent', dueDate: '2028-02-29' };
    seed([planned]);
    const { result } = renderHook(() => useTasks());
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => {
      expect(result.current.updateTaskDetails(base.id, { ...details, dueDate: '2026-04-31' })).toEqual({ ok: false, error: 'invalid-date' });
    });
    expect(result.current.tasks).toEqual([planned]);
    expect(write).not.toHaveBeenCalled();
    act(() => { result.current.updateTaskDetails(base.id, { title: base.title, important: false, urgency: 'none', dueDate: '' }); });
    expect(result.current.tasks).toEqual([base]);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('does not write an effective no-op or create a missing task', () => {
    seed([{ ...base, important: false, urgency: 'none' }]);
    const { result } = renderHook(() => useTasks());
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const initial = result.current.tasks;
    act(() => {
      result.current.updateTaskDetails(base.id, { title: `  ${base.title}  `, important: false, urgency: 'none', dueDate: '' });
      result.current.updateTaskDetails('missing', details);
    });
    expect(result.current.tasks).toBe(initial);
    expect(write).not.toHaveBeenCalled();
  });
  it('preserves all planning fields through legacy rename, toggle, remove and undo', () => {
    const planned: Task = { ...base, important: true, urgency: 'later', dueDate: '2028-02-29' };
    seed([planned]);
    const { result } = renderHook(() => useTasks());
    act(() => {
      result.current.updateTask(base.id, 'Переименована');
      result.current.toggleTask(base.id);
      result.current.removeTask(base.id);
      result.current.undoRemoval();
    });
    expect(result.current.tasks).toEqual([{ ...planned, title: 'Переименована', completed: false }]);
  });
});

describe('stable task views', () => {
  const task = (id: string, planning: Partial<Task> = {}): Task => Object.freeze({ id, title: id, completed: false, ...planning });
  it('uses independent importance and urgency, with stable ties and no input mutation', () => {
    const tasks = Object.freeze([
      task('later', { urgency: 'later' }), task('normal'), task('important', { important: true }),
      task('urgent', { urgency: 'urgent' }), task('both', { important: true, urgency: 'urgent' }),
      task('important-later', { important: true, urgency: 'later' }), task('urgent-tie', { urgency: 'urgent', completed: true }),
    ]);
    expect(sortTasks(tasks, 'manual')).toBe(tasks);
    expect(sortTasks(tasks, 'priority').map(({ id }) => id)).toEqual(['both', 'important', 'important-later', 'urgent', 'urgent-tie', 'normal', 'later']);
    expect(tasks.map(({ id }) => id)).toEqual(['later', 'normal', 'important', 'urgent', 'both', 'important-later', 'urgent-tie']);
  });
  it('puts the earliest calendar day first, keeps undated tasks last and preserves equal-date order', () => {
    const tasks = Object.freeze([
      task('no-date'), task('future', { dueDate: '9999-12-31' }), task('earliest', { dueDate: '0001-01-01' }),
      task('same-a', { dueDate: '2026-11-04', completed: true }), task('same-b', { dueDate: '2026-11-04' }), task('also-no-date'),
    ]);
    expect(sortTasks(tasks, 'due-date').map(({ id }) => id)).toEqual(['earliest', 'same-a', 'same-b', 'future', 'no-date', 'also-no-date']);
  });
});
