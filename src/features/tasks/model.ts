export const MAX_TASK_TITLE_LENGTH = 200;
export const STORAGE_VERSION = 1;
export const STORAGE_KEY = 'todo-list:tasks:v1';

export type Task = Readonly<{
  id: string;
  title: string;
  completed: boolean;
}>;

export type StoredTasks = Readonly<{
  version: typeof STORAGE_VERSION;
  tasks: readonly Task[];
}>;

export type TitleError = 'empty' | 'too-long';
export type TitleValidation =
  | { readonly ok: true; readonly title: string }
  | { readonly ok: false; readonly error: TitleError };

export type AddTaskResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: TitleError };

export type TaskAction =
  | { readonly type: 'add'; readonly task: Task }
  | { readonly type: 'toggle'; readonly id: Task['id'] }
  | { readonly type: 'remove'; readonly id: Task['id'] };

export type LoadResult =
  | { readonly kind: 'ready'; readonly tasks: readonly Task[] }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'unavailable' };

export type SaveResult = { readonly ok: true } | { readonly ok: false };
export type StorageStatus = 'available' | 'invalid' | 'unavailable' | 'write-error';

export interface TasksController {
  readonly tasks: readonly Task[];
  readonly storageStatus: StorageStatus;
  addTask(title: string): AddTaskResult;
  toggleTask(id: Task['id']): void;
  removeTask(id: Task['id']): void;
  replaceSavedTasks(): SaveResult;
}

export function validateTaskTitle(input: string): TitleValidation {
  const title = input.trim();
  if (title.length === 0) return { ok: false, error: 'empty' };
  if (title.length > MAX_TASK_TITLE_LENGTH) return { ok: false, error: 'too-long' };
  return { ok: true, title };
}
