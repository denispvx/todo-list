import type { Task, TaskAction } from './model';
import { taskPlanningFields } from './planning';

export function tasksReducer(tasks: readonly Task[], action: TaskAction): readonly Task[] {
  switch (action.type) {
    case 'add':
      return [action.task, ...tasks];
    case 'add-many':
      return action.tasks.length === 0 ? tasks : [...action.tasks, ...tasks];
    case 'toggle':
      if (!tasks.some((task) => task.id === action.id)) return tasks;
      return tasks.map((task) => task.id === action.id
        ? { ...task, completed: !task.completed }
        : task);
    case 'remove':
      if (!tasks.some((task) => task.id === action.id)) return tasks;
      return tasks.filter((task) => task.id !== action.id);
    case 'update':
      if (!tasks.some((task) => task.id === action.id && task.title !== action.title)) return tasks;
      return tasks.map((task) => task.id === action.id ? { ...task, title: action.title } : task);
    case 'update-details': {
      const existing = tasks.find((task) => task.id === action.id);
      const details = action.details;
      if (!existing || (existing.title === details.title
        && Boolean(existing.important) === details.important
        && (existing.urgency ?? 'none') === details.urgency
        && (existing.dueDate ?? '') === details.dueDate)) return tasks;
      return tasks.map((task) => task.id === action.id ? {
        id: task.id, title: details.title, completed: task.completed, ...taskPlanningFields(details),
      } : task);
    }
    case 'restore': {
      if (tasks.some((task) => task.id === action.task.id)) return tasks;
      const index = Math.min(Math.max(action.index, 0), tasks.length);
      return [...tasks.slice(0, index), action.task, ...tasks.slice(index)];
    }
  }
}
