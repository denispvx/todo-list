import type { Task, TaskAction } from './model';

export function tasksReducer(tasks: readonly Task[], action: TaskAction): readonly Task[] {
  switch (action.type) {
    case 'add':
      return [action.task, ...tasks];
    case 'toggle':
      if (!tasks.some((task) => task.id === action.id)) return tasks;
      return tasks.map((task) => task.id === action.id
        ? { ...task, completed: !task.completed }
        : task);
    case 'remove':
      if (!tasks.some((task) => task.id === action.id)) return tasks;
      return tasks.filter((task) => task.id !== action.id);
  }
}
