import { useRef, useState } from 'react';
import { validateTaskTitle } from './model';
import type { AddTaskResult, SaveResult, StorageStatus, Task, TaskAction, TasksController } from './model';
import { tasksReducer } from './reducer';
import { loadTasks, saveTasks } from './storage';

type TasksState = Readonly<{
  tasks: readonly Task[];
  storageStatus: StorageStatus;
}>;

function initialState(): TasksState {
  const loaded = loadTasks();
  return loaded.kind === 'ready'
    ? { tasks: loaded.tasks, storageStatus: 'available' }
    : { tasks: [], storageStatus: loaded.kind };
}

export function useTasks(): TasksController {
  const [state, setState] = useState(initialState);
  const latestState = useRef(state);

  function publish(next: TasksState) {
    latestState.current = next;
    setState(next);
  }

  function commit(action: TaskAction) {
    const current = latestState.current;
    const tasks = tasksReducer(current.tasks, action);
    if (tasks === current.tasks) return;

    let storageStatus = current.storageStatus;
    if (storageStatus === 'available' || storageStatus === 'write-error') {
      storageStatus = saveTasks(tasks).ok ? 'available' : 'write-error';
    }

    publish({ tasks, storageStatus });
  }

  function addTask(input: string): AddTaskResult {
    const result = validateTaskTitle(input);
    if (!result.ok) return result;

    const task: Task = {
      id: crypto.randomUUID(),
      title: result.title,
      completed: false,
    };
    commit({ type: 'add', task });
    return { ok: true };
  }

  function toggleTask(id: Task['id']) {
    commit({ type: 'toggle', id });
  }

  function removeTask(id: Task['id']) {
    commit({ type: 'remove', id });
  }

  function replaceSavedTasks(): SaveResult {
    const current = latestState.current;
    if (current.storageStatus !== 'invalid') return { ok: false };

    const result = saveTasks(current.tasks);
    if (result.ok) publish({ ...current, storageStatus: 'available' });
    return result;
  }

  return {
    tasks: state.tasks,
    storageStatus: state.storageStatus,
    addTask,
    toggleTask,
    removeTask,
    replaceSavedTasks,
  };
}
