import { STORAGE_KEY, STORAGE_VERSION, validateTaskTitle } from './model';
import type { LoadResult, StoredTasks, Task } from './model';
import { isTaskUrgency, isValidDate } from './planning';

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
    if (('important' in item && typeof item.important !== 'boolean')
      || ('urgency' in item && !isTaskUrgency(item.urgency))
      || ('dueDate' in item && !isValidDate(item.dueDate))) return null;

    ids.add(item.id);
    tasks.push({
      id: item.id, title: item.title, completed: item.completed,
      ...(typeof item.important === 'boolean' ? { important: item.important } : {}),
      ...(isTaskUrgency(item.urgency) ? { urgency: item.urgency } : {}),
      ...(typeof item.dueDate === 'string' ? { dueDate: item.dueDate } : {}),
    });
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

  if (serialized === null) return { kind: 'ready', tasks: [], snapshot: null };

  try {
    const value: unknown = JSON.parse(serialized);
    const tasks = decodeTasks(value);
    return tasks === null
      ? { kind: 'invalid', snapshot: serialized }
      : { kind: 'ready', tasks, snapshot: serialized };
  } catch {
    return { kind: 'invalid', snapshot: serialized };
  }
}

type WriteResult =
  | { readonly ok: true; readonly snapshot: string }
  | { readonly ok: false; readonly reason: 'write-error' | 'conflict' };

export function saveTasks(tasks: readonly Task[], expectedSnapshot: string | null): WriteResult {
  try {
    const storage = window.localStorage;
    const payload: StoredTasks = { version: STORAGE_VERSION, tasks };
    const snapshot = JSON.stringify(payload);
    if (storage.getItem(STORAGE_KEY) !== expectedSnapshot) return { ok: false, reason: 'conflict' };
    storage.setItem(STORAGE_KEY, snapshot);
    return { ok: true, snapshot };
  } catch {
    return { ok: false, reason: 'write-error' };
  }
}
