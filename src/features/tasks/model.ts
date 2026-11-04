export const MAX_TASK_TITLE_LENGTH = 200;
export const STORAGE_VERSION = 1;
export const STORAGE_KEY = 'todo-list:tasks:v1';

export type TaskUrgency = 'none' | 'urgent' | 'later';

export type TaskDetails = Readonly<{
  title: string;
  important: boolean;
  urgency: TaskUrgency;
  dueDate: string;
}>;

export type Task = Readonly<{
  id: string;
  title: string;
  completed: boolean;
  important?: boolean;
  urgency?: TaskUrgency;
  dueDate?: string;
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

export type TaskDetailsError = TitleError | 'invalid-date' | 'invalid-planning';
export type TaskDetailsResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: TaskDetailsError };

export type BatchAddResult =
  | { readonly ok: true; readonly count: number }
  | { readonly ok: false; readonly error: 'empty' | 'too-many' | 'invalid' };

export type TaskAction =
  | { readonly type: 'add'; readonly task: Task }
  | { readonly type: 'add-many'; readonly tasks: readonly Task[] }
  | { readonly type: 'toggle'; readonly id: Task['id'] }
  | { readonly type: 'update'; readonly id: Task['id']; readonly title: string }
  | { readonly type: 'update-details'; readonly id: Task['id']; readonly details: TaskDetails }
  | { readonly type: 'remove'; readonly id: Task['id'] }
  | { readonly type: 'restore'; readonly task: Task; readonly index: number };

export type LoadResult =
  | { readonly kind: 'ready'; readonly tasks: readonly Task[] }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'unavailable' };

export type SaveResult = { readonly ok: true } | { readonly ok: false };
export type StorageStatus = 'available' | 'invalid' | 'unavailable' | 'write-error';

export interface TasksController {
  readonly tasks: readonly Task[];
  readonly storageStatus: StorageStatus;
  readonly lastRemovedTask: Task | null;
  addTask(title: string): AddTaskResult;
  addTasks(titles: readonly string[]): BatchAddResult;
  updateTask(id: Task['id'], title: string): AddTaskResult;
  addPlannedTask(details: TaskDetails): TaskDetailsResult;
  updateTaskDetails(id: Task['id'], details: TaskDetails): TaskDetailsResult;
  toggleTask(id: Task['id']): void;
  removeTask(id: Task['id']): void;
  undoRemoval(): boolean;
  dismissUndo(): void;
  replaceSavedTasks(): SaveResult;
}

export function validateTaskTitle(input: string): TitleValidation {
  const title = input.trim();
  if (title.length === 0) return { ok: false, error: 'empty' };
  if (title.length > MAX_TASK_TITLE_LENGTH) return { ok: false, error: 'too-long' };
  return { ok: true, title };
}
