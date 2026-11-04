import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, STORAGE_VERSION, type Task } from '../src/features/tasks/model';
import { useTasks } from '../src/features/tasks/useTasks';

const original: readonly Task[] = [
  { id: 'a', title: 'Первая', completed: false },
  { id: 'b', title: 'Вторая', completed: true },
  { id: 'c', title: 'Третья', completed: false },
];
function seed(tasks: readonly Task[] = original) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, tasks }));
}
beforeEach(() => window.localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('task removal undo', () => {
  it('restores the same task before its next neighbor after add, batch and toggle', () => {
    seed();
    const { result } = renderHook(() => useTasks(), { wrapper: StrictMode });
    act(() => result.current.removeTask('b'));
    expect(result.current.lastRemovedTask).toEqual(original[1]);
    act(() => {
      result.current.addTask('Новая');
      result.current.addTasks(['Пакет 1', 'Пакет 2']);
      result.current.toggleTask('a');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    act(() => { expect(result.current.undoRemoval()).toBe(true); });

    expect(result.current.tasks.map((task) => task.title)).toEqual(['Пакет 1', 'Пакет 2', 'Новая', 'Первая', 'Вторая', 'Третья']);
    expect(result.current.tasks.find((task) => task.id === 'b')).toEqual(original[1]);
    expect(result.current.tasks.find((task) => task.id === 'a')?.completed).toBe(true);
    expect(new Set(result.current.tasks.map((task) => task.id)).size).toBe(6);
    expect(result.current.lastRemovedTask).toBeNull();
    expect(setItem).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY, expect.any(String));
  });

  it('restores a deleted last row after its previous neighbor, behind new tasks', () => {
    seed();
    const { result } = renderHook(() => useTasks());
    act(() => { result.current.removeTask('c'); result.current.addTasks(['X', 'Y']); result.current.undoRemoval(); });

    expect(result.current.tasks.map((task) => task.title)).toEqual(['X', 'Y', 'Первая', 'Вторая', 'Третья']);
  });

  it('appends an originally sole task after newly added tasks', () => {
    seed([original[0]!]);
    const { result } = renderHook(() => useTasks());
    act(() => { result.current.removeTask('a'); result.current.addTasks(['X', 'Y']); result.current.undoRemoval(); });

    expect(result.current.tasks.map((task) => task.title)).toEqual(['X', 'Y', 'Первая']);
    expect(result.current.tasks[2]).toEqual(original[0]);
  });

  it('keeps only the latest real deletion and ignores unknown IDs without writing', () => {
    seed();
    const { result } = renderHook(() => useTasks());
    act(() => { result.current.removeTask('b'); result.current.removeTask('a'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    act(() => result.current.removeTask('missing'));
    expect(result.current.lastRemovedTask?.id).toBe('a');
    expect(setItem).not.toHaveBeenCalled();
    act(() => { expect(result.current.undoRemoval()).toBe(true); });
    expect(result.current.tasks.map((task) => task.id)).toEqual(['a', 'c']);
    setItem.mockClear();
    act(() => { expect(result.current.undoRemoval()).toBe(false); });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not duplicate a restored ID when undo is requested twice in one event', () => {
    seed();
    const { result } = renderHook(() => useTasks());
    act(() => result.current.removeTask('b'));
    const controller = result.current;
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    act(() => { expect(controller.undoRemoval()).toBe(true); expect(controller.undoRemoval()).toBe(false); });

    expect(result.current.tasks).toEqual(original);
    expect(new Set(result.current.tasks.map((task) => task.id)).size).toBe(3);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('dismisses only undo history and does not persist it or resurrect it after remount', () => {
    seed();
    const { result, unmount } = renderHook(() => useTasks());
    act(() => result.current.removeTask('b'));
    const before = window.localStorage.getItem(STORAGE_KEY);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    act(() => { result.current.dismissUndo(); expect(result.current.undoRemoval()).toBe(false); });

    expect(result.current.lastRemovedTask).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(JSON.parse(before!)).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });
    unmount();
    const reloaded = renderHook(() => useTasks());
    expect(reloaded.result.current.lastRemovedTask).toBeNull();
    expect(reloaded.result.current.tasks.map((task) => task.id)).toEqual(['a', 'c']);
  });

  it('allows undo in invalid-data memory mode without overwriting unread data', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useTasks());
    act(() => result.current.addTasks(['A', 'B']));
    const removed = result.current.tasks[0]!;
    act(() => { result.current.removeTask(removed.id); result.current.undoRemoval(); });

    expect(result.current.tasks[0]).toEqual(removed);
    expect(result.current.storageStatus).toBe('invalid');
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });

  it('keeps batch and undo writes blocked after unavailable storage becomes readable', () => {
    seed();
    const before = window.localStorage.getItem(STORAGE_KEY);
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const { result } = renderHook(() => useTasks());
    read.mockRestore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    act(() => result.current.addTasks(['A', 'B']));
    const removed = result.current.tasks[0]!;
    act(() => { result.current.removeTask(removed.id); result.current.undoRemoval(); });

    expect(result.current.tasks[0]).toEqual(removed);
    expect(result.current.storageStatus).toBe('unavailable');
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('restores in memory after a failed undo save and recovers on the next mutation', () => {
    seed();
    const { result } = renderHook(() => useTasks());
    act(() => result.current.removeTask('b'));
    const before = window.localStorage.getItem(STORAGE_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new DOMException('Quota', 'QuotaExceededError'); });

    act(() => { expect(result.current.undoRemoval()).toBe(true); });

    expect(result.current.tasks).toEqual(original);
    expect(result.current.storageStatus).toBe('write-error');
    expect(result.current.lastRemovedTask).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
    act(() => result.current.toggleTask('a'));
    expect(result.current.storageStatus).toBe('available');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).tasks).toEqual(result.current.tasks);
  });
});
