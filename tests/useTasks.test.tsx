import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_TASK_TITLE_LENGTH,
  STORAGE_KEY,
  STORAGE_VERSION,
  type AddTaskResult,
  type Task,
} from '../src/features/tasks/model';
import { useTasks } from '../src/features/tasks/useTasks';

const savedTask: Task = { id: 'saved', title: 'Сохранённая задача', completed: false };

function seed(tasks: readonly Task[]): string {
  const raw = JSON.stringify({ version: STORAGE_VERSION, tasks });
  window.localStorage.setItem(STORAGE_KEY, raw);
  return raw;
}

function persistedTasks(): unknown {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

function mountTasks() {
  return renderHook(() => useTasks(), { wrapper: StrictMode });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('useTasks', () => {
  it('restores existing data under StrictMode without saving during mount', () => {
    const raw = seed([savedTask]);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = mountTasks();

    expect(result.current.tasks).toEqual([savedTask]);
    expect(result.current.storageStatus).toBe('available');
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('normalizes raw input, persists completion and keeps deletions after remount', () => {
    const { result, unmount } = mountTasks();
    let added: AddTaskResult | undefined;

    act(() => {
      added = result.current.addTask('  Купить  хлеб 📝  ');
    });

    expect(added).toEqual({ ok: true });
    expect(result.current.tasks).toEqual([
      { id: expect.any(String), title: 'Купить  хлеб 📝', completed: false },
    ]);
    const id = result.current.tasks[0]!.id;
    expect(persistedTasks()).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });

    act(() => result.current.toggleTask(id));
    expect(result.current.tasks[0]?.completed).toBe(true);
    expect(persistedTasks()).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });

    act(() => result.current.removeTask(id));
    expect(result.current.tasks).toEqual([]);
    expect(persistedTasks()).toEqual({ version: STORAGE_VERSION, tasks: [] });

    unmount();
    const reloaded = mountTasks();
    expect(reloaded.result.current.tasks).toEqual([]);
  });

  it('rejects invalid input without creating tasks or writing data', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = mountTasks();
    let empty: AddTaskResult | undefined;
    let oversized: AddTaskResult | undefined;

    act(() => {
      empty = result.current.addTask('   ');
      oversized = result.current.addTask('я'.repeat(MAX_TASK_TITLE_LENGTH + 1));
    });

    expect(empty).toEqual({ ok: false, error: 'empty' });
    expect(oversized).toEqual({ ok: false, error: 'too-long' });
    expect(result.current.tasks).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('applies several actions from one render without losing the latest state', () => {
    seed([savedTask, { id: 'remove-me', title: 'Удалить меня', completed: false }]);
    const { result } = mountTasks();
    const controller = result.current;

    act(() => {
      controller.addTask('A');
      controller.addTask('B');
      controller.toggleTask(savedTask.id);
      controller.removeTask('remove-me');
    });

    expect(result.current.tasks.map((task) => task.title)).toEqual(['B', 'A', savedTask.title]);
    expect(result.current.tasks[2]?.completed).toBe(true);
    expect(new Set(result.current.tasks.map((task) => task.id)).size).toBe(3);
    expect(persistedTasks()).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });
  });

  it('does not save or replace storage for unknown IDs or a non-invalid list', () => {
    seed([savedTask]);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = mountTasks();
    const before = result.current.tasks;

    act(() => {
      result.current.toggleTask('missing');
      result.current.removeTask('missing');
      expect(result.current.replaceSavedTasks()).toEqual({ ok: false });
    });

    expect(result.current.tasks).toBe(before);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('keeps invalid data untouched until the user explicitly replaces it', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = mountTasks();

    act(() => result.current.addTask('  Новый список  '));

    expect(result.current.storageStatus).toBe('invalid');
    expect(result.current.tasks[0]?.title).toBe('Новый список');
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{broken');

    act(() => {
      expect(result.current.replaceSavedTasks()).toEqual({ ok: true });
    });

    expect(result.current.storageStatus).toBe('available');
    expect(persistedTasks()).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });

    act(() => result.current.addTask('Следующая задача'));
    expect(persistedTasks()).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });
    expect(result.current.tasks).toHaveLength(2);
  });

  it('keeps automatic saving blocked when replacement of invalid data fails', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken');
    const { result } = mountTasks();
    act(() => result.current.addTask('Первая'));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });

    act(() => {
      expect(result.current.replaceSavedTasks()).toEqual({ ok: false });
    });
    act(() => result.current.addTask('Вторая'));

    expect(result.current.storageStatus).toBe('invalid');
    expect(result.current.tasks.map((task) => task.title)).toEqual(['Вторая', 'Первая']);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });

  it.each(['storage getter', 'getItem'] as const)(
    'never overwrites unread data after a failed %s, even when storage becomes available',
    (failure) => {
      const raw = seed([savedTask]);
      const read = failure === 'storage getter'
        ? vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
          throw new DOMException('Storage access denied', 'SecurityError');
        })
        : vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new DOMException('Reading denied', 'SecurityError');
        });
      const { result } = mountTasks();
      read.mockRestore();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      act(() => result.current.addTask('Только в памяти'));
      act(() => {
        expect(result.current.replaceSavedTasks()).toEqual({ ok: false });
      });

      expect(result.current.storageStatus).toBe('unavailable');
      expect(result.current.tasks[0]?.title).toBe('Только в памяти');
      expect(setItem).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
    },
  );

  it('keeps unsaved changes in memory and recovers on the next successful mutation', () => {
    const raw = seed([]);
    const { result } = mountTasks();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });

    act(() => result.current.addTask('Первая'));

    expect(result.current.tasks[0]?.title).toBe('Первая');
    expect(result.current.storageStatus).toBe('write-error');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);

    act(() => result.current.addTask('Вторая'));

    expect(result.current.tasks.map((task) => task.title)).toEqual(['Вторая', 'Первая']);
    expect(result.current.storageStatus).toBe('available');
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(persistedTasks()).toEqual({ version: STORAGE_VERSION, tasks: result.current.tasks });
  });
});
