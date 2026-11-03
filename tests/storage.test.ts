import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_TASK_TITLE_LENGTH,
  STORAGE_KEY,
  STORAGE_VERSION,
  type Task,
} from '../src/features/tasks/model';
import { loadTasks, saveTasks } from '../src/features/tasks/storage';

const task: Task = { id: 'saved', title: 'Проверить сохранение 📝', completed: true };
const envelope = (tasks: unknown) => ({ version: STORAGE_VERSION, tasks });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('loadTasks', () => {
  it('treats an absent key as an empty list without creating storage data', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    expect(loadTasks()).toEqual({ kind: 'ready', tasks: [] });
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restores text, completion and order without writing during a read', () => {
    const tasks = [task, { id: 'second', title: task.title, completed: false }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope(tasks)));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    expect(loadTasks()).toEqual({ kind: 'ready', tasks });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not replace malformed JSON', () => {
    const raw = '{broken';
    window.localStorage.setItem(STORAGE_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    expect(loadTasks()).toEqual({ kind: 'invalid' });
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it.each([
    ['null envelope', null],
    ['array envelope', []],
    ['missing tasks', { version: STORAGE_VERSION }],
    ['unknown version', { version: STORAGE_VERSION + 1, tasks: [] }],
    ['string version', { version: String(STORAGE_VERSION), tasks: [] }],
    ['non-array tasks', envelope({})],
    ['null task', envelope([null])],
    ['non-string ID', envelope([{ ...task, id: 1 }])],
    ['empty ID', envelope([{ ...task, id: '' }])],
    ['whitespace ID', envelope([{ ...task, id: '   ' }])],
    ['non-string title', envelope([{ ...task, title: 1 }])],
    ['empty title', envelope([{ ...task, title: '' }])],
    ['noncanonical title', envelope([{ ...task, title: '  Сохранённая задача  ' }])],
    ['oversized title', envelope([{ ...task, title: 'я'.repeat(MAX_TASK_TITLE_LENGTH + 1) }])],
    ['non-boolean completion', envelope([{ ...task, completed: 'false' }])],
    ['duplicate IDs', envelope([task, { ...task, title: 'Другое название' }])],
  ])('rejects %s as a whole without changing the original value', (_description, value) => {
    const raw = JSON.stringify(value);
    window.localStorage.setItem(STORAGE_KEY, raw);

    expect(loadTasks()).toEqual({ kind: 'invalid' });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('returns unavailable when access to localStorage is denied', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });

    expect(loadTasks()).toEqual({ kind: 'unavailable' });
  });

  it('returns unavailable when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Reading denied', 'SecurityError');
    });

    expect(loadTasks()).toEqual({ kind: 'unavailable' });
  });
});

describe('saveTasks', () => {
  it('writes the versioned list without changing other application keys', () => {
    window.localStorage.setItem('another-app:key', 'keep me');

    expect(saveTasks([task])).toEqual({ ok: true });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(envelope([task]));
    expect(window.localStorage.getItem('another-app:key')).toBe('keep me');
  });

  it('persists an empty list so deleted tasks do not reappear', () => {
    saveTasks([task]);

    expect(saveTasks([])).toEqual({ ok: true });
    expect(loadTasks()).toEqual({ kind: 'ready', tasks: [] });
  });

  it('reports a write error and preserves previously saved data', () => {
    const raw = JSON.stringify(envelope([task]));
    window.localStorage.setItem(STORAGE_KEY, raw);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });

    expect(saveTasks([])).toEqual({ ok: false });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('reports failure when the storage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });

    expect(saveTasks([task])).toEqual({ ok: false });
  });
});
