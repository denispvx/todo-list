import { validateTaskTitle } from './model';
import type { Task, TaskDetails, TaskDetailsError, TaskUrgency } from './model';

export type TaskOrder = 'manual' | 'priority' | 'due-date';

export function isTaskUrgency(value: unknown): value is TaskUrgency {
  return value === 'none' || value === 'urgent' || value === 'later';
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

export function validateTaskDetails(details: TaskDetails):
  | { readonly ok: true; readonly details: TaskDetails }
  | { readonly ok: false; readonly error: TaskDetailsError } {
  if (typeof details !== 'object' || details === null || typeof details.title !== 'string'
    || typeof details.important !== 'boolean' || !isTaskUrgency(details.urgency)
    || typeof details.dueDate !== 'string') return { ok: false, error: 'invalid-planning' };
  const title = validateTaskTitle(details.title);
  if (!title.ok) return title;
  if (details.dueDate !== '' && !isValidDate(details.dueDate)) return { ok: false, error: 'invalid-date' };
  return { ok: true, details: { ...details, title: title.title } };
}

export function taskPlanningFields(details: TaskDetails): Pick<Task, 'important' | 'urgency' | 'dueDate'> {
  return {
    ...(details.important ? { important: true } : {}),
    ...(details.urgency !== 'none' ? { urgency: details.urgency } : {}),
    ...(details.dueDate ? { dueDate: details.dueDate } : {}),
  };
}

export function localDateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDueDate(dueDate: string, completed: boolean, now = new Date()): { label: string; overdue: boolean } {
  if (!isValidDate(dueDate)) return { label: '', overdue: false };
  const today = localDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dueDate === today) return { label: 'Сегодня', overdue: false };
  if (dueDate === localDateKey(tomorrow)) return { label: 'Завтра', overdue: false };
  // Construct a local calendar day explicitly: parsing an ISO date as a Date uses UTC.
  const date = new Date(0);
  date.setFullYear(Number(dueDate.slice(0, 4)), Number(dueDate.slice(5, 7)) - 1, Number(dueDate.slice(8, 10)));
  date.setHours(12, 0, 0, 0);
  const formatted = new Intl.DateTimeFormat('ru', {
    day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
  const overdue = !completed && dueDate < today;
  return { label: overdue ? `Просрочено · ${formatted}` : formatted, overdue };
}

function priority(task: Task): number {
  const importance = task.important ? 0 : 3;
  return importance + (task.urgency === 'urgent' ? 0 : task.urgency === 'later' ? 2 : 1);
}

export function sortTasks(tasks: readonly Task[], order: TaskOrder): readonly Task[] {
  if (order === 'manual') return tasks;
  return tasks.map((task, index) => ({ task, index })).sort((a, b) => {
    if (order === 'priority') return priority(a.task) - priority(b.task) || a.index - b.index;
    const first = a.task.dueDate ?? '9999-99-99';
    const second = b.task.dueDate ?? '9999-99-99';
    return (first < second ? -1 : first > second ? 1 : 0) || a.index - b.index;
  }).map(({ task }) => task);
}
