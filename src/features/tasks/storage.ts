import { STORAGE_KEY, STORAGE_VERSION, validateTaskTitle } from './model';
import type { LoadResult, SaveResult, StoredTasks, Task } from './model';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeTasks(value: unknown): readonly Task[] | null {
  if (!isRecord(value) || value.version !== STORAGE_VERSION || !Array.isArray(value.tasks)) {
    return null;
  }

  const tasks: Task[] = [];
  const ids = new Set<string>();

  for (const item of value.tasks) {
    if (!isRecord(item)
      || typeof item.id !== 'string'
      || item.id.trim().length === 0
      || ids.has(item.id)
      || typeof item.title !== 'string'
      || typeof item.completed !== 'boolean') {
      return null;
    }

    const title = validateTaskTitle(item.title);
    if (!title.ok || title.title !== item.title) return null;

    ids.add(item.id);
    tasks.push({ id: item.id, title: item.title, completed: item.completed });
  }

  return tasks;
}

export function loadTasks(): LoadResult {
  let serialized: string | null;
  try {
    serialized = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { kind: 'unavailable' };
  }

  if (serialized === null) return { kind: 'ready', tasks: [] };

  try {
    const value: unknown = JSON.parse(serialized);
    const tasks = decodeTasks(value);
    return tasks === null ? { kind: 'invalid' } : { kind: 'ready', tasks };
  } catch {
    return { kind: 'invalid' };
  }
}

export function saveTasks(tasks: readonly Task[]): SaveResult {
  try {
    const payload: StoredTasks = { version: STORAGE_VERSION, tasks };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
