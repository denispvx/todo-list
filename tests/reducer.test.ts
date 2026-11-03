import { describe, expect, it } from 'vitest';
import { tasksReducer } from '../src/features/tasks/reducer';
import type { Task } from '../src/features/tasks/model';

function existingTasks(): readonly Task[] {
  return Object.freeze([
    Object.freeze({ id: 'first', title: 'Проверить отчёт', completed: false }),
    Object.freeze({ id: 'second', title: 'Проверить отчёт', completed: true }),
  ]);
}

describe('tasksReducer', () => {
  it('prepends without mutating the list or merging duplicate titles', () => {
    const tasks = existingTasks();
    const added = Object.freeze({ id: 'third', title: 'Проверить отчёт', completed: false });

    const next = tasksReducer(tasks, { type: 'add', task: added });

    expect(next).toEqual([added, ...tasks]);
    expect(next).not.toBe(tasks);
    expect(tasks).toHaveLength(2);
    expect(next[1]).toBe(tasks[0]);
  });

  it('toggles only the matching ID without moving rows or mutating a task', () => {
    const tasks = existingTasks();

    const next = tasksReducer(tasks, { type: 'toggle', id: 'first' });

    expect(next).toEqual([
      { id: 'first', title: 'Проверить отчёт', completed: true },
      tasks[1],
    ]);
    expect(next[0]).not.toBe(tasks[0]);
    expect(next[1]).toBe(tasks[1]);
    expect(tasks[0]?.completed).toBe(false);
    expect(tasksReducer(next, { type: 'toggle', id: 'first' })).toEqual(tasks);
  });

  it('removes only the requested ID when titles are identical', () => {
    const tasks = existingTasks();

    expect(tasksReducer(tasks, { type: 'remove', id: 'second' })).toEqual([tasks[0]]);
    expect(tasks).toHaveLength(2);
  });

  it.each(['toggle', 'remove'] as const)('preserves the original list for an unknown %s ID', (type) => {
    const tasks = existingTasks();

    expect(tasksReducer(tasks, { type, id: 'missing' })).toBe(tasks);
  });

  it('keeps an empty list after its final task is removed', () => {
    const task = { id: 'last', title: 'Последняя задача', completed: true };

    expect(tasksReducer([task], { type: 'remove', id: task.id })).toEqual([]);
  });
});
