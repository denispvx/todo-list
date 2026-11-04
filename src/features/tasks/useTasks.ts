import { useRef, useState } from 'react';
import { MAX_BATCH_TASKS } from './batch';
import { validateTaskTitle } from './model';
import type { AddTaskResult, BatchAddResult, SaveResult, StorageStatus, Task, TaskAction, TaskDetails, TaskDetailsResult, TasksController } from './model';
import { taskPlanningFields, validateTaskDetails } from './planning';
import { tasksReducer } from './reducer';
import { loadTasks, saveTasks } from './storage';

type RemovalRecord = Readonly<{
  task: Task;
  index: number;
  previousId: Task['id'] | null;
  nextId: Task['id'] | null;
}>;

type TasksState = Readonly<{
  tasks: readonly Task[];
  storageStatus: StorageStatus;
  lastRemoval: RemovalRecord | null;
}>;

function initialState(): TasksState {
  const loaded = loadTasks();
  return loaded.kind === 'ready'
    ? { tasks: loaded.tasks, storageStatus: 'available', lastRemoval: null }
    : { tasks: [], storageStatus: loaded.kind, lastRemoval: null };
}

export function useTasks(): TasksController {
  const [state, setState] = useState(initialState);
  const latestState = useRef(state);

  function publish(next: TasksState) {
    latestState.current = next;
    setState(next);
  }

  function commit(action: TaskAction, removal?: RemovalRecord | null) {
    const current = latestState.current;
    const tasks = tasksReducer(current.tasks, action);
    if (tasks === current.tasks) return;

    let storageStatus = current.storageStatus;
    if (storageStatus === 'available' || storageStatus === 'write-error') {
      storageStatus = saveTasks(tasks).ok ? 'available' : 'write-error';
    }

    publish({ tasks, storageStatus, lastRemoval: removal === undefined ? current.lastRemoval : removal });
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

  function addPlannedTask(details: TaskDetails): TaskDetailsResult {
    const result = validateTaskDetails(details);
    if (!result.ok) return result;
    const task: Task = {
      id: crypto.randomUUID(), title: result.details.title, completed: false,
      ...taskPlanningFields(result.details),
    };
    commit({ type: 'add', task });
    return { ok: true };
  }

  function updateTaskDetails(id: Task['id'], details: TaskDetails): TaskDetailsResult {
    const result = validateTaskDetails(details);
    if (!result.ok) return result;
    commit({ type: 'update-details', id, details: result.details });
    return { ok: true };
  }

  function updateTask(id: Task['id'], input: string): AddTaskResult {
    const result = validateTaskTitle(input);
    if (!result.ok) return result;
    commit({ type: 'update', id, title: result.title });
    return { ok: true };
  }

  function removeTask(id: Task['id']) {
    const current = latestState.current;
    const index = current.tasks.findIndex((task) => task.id === id);
    const task = current.tasks[index];
    if (!task) return;

    commit({ type: 'remove', id }, {
      task,
      index,
      previousId: current.tasks[index - 1]?.id ?? null,
      nextId: current.tasks[index + 1]?.id ?? null,
    });
  }

  function addTasks(inputs: readonly string[]): BatchAddResult {
    if (inputs.length === 0) return { ok: false, error: 'empty' };
    if (inputs.length > MAX_BATCH_TASKS) return { ok: false, error: 'too-many' };

    const titles: string[] = [];
    for (const input of inputs) {
      if (typeof input !== 'string') return { ok: false, error: 'invalid' };
      const result = validateTaskTitle(input);
      if (!result.ok) return { ok: false, error: 'invalid' };
      titles.push(result.title);
    }

    const tasks = titles.map((title): Task => ({ id: crypto.randomUUID(), title, completed: false }));
    commit({ type: 'add-many', tasks });
    return { ok: true, count: tasks.length };
  }

  function undoRemoval(): boolean {
    const current = latestState.current;
    const removal = current.lastRemoval;
    if (!removal) return false;

    if (current.tasks.some((task) => task.id === removal.task.id)) {
      publish({ ...current, lastRemoval: null });
      return false;
    }

    const nextIndex = current.tasks.findIndex((task) => task.id === removal.nextId);
    const previousIndex = current.tasks.findIndex((task) => task.id === removal.previousId);
    const index = nextIndex >= 0
      ? nextIndex
      : previousIndex >= 0
        ? previousIndex + 1
        : removal.nextId === null && removal.previousId === null
          ? current.tasks.length
          : Math.min(removal.index, current.tasks.length);

    commit({ type: 'restore', task: removal.task, index }, null);
    return true;
  }

  function dismissUndo() {
    const current = latestState.current;
    if (current.lastRemoval) publish({ ...current, lastRemoval: null });
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
    lastRemovedTask: state.lastRemoval?.task ?? null,
    addTask,
    addTasks,
    updateTask,
    addPlannedTask,
    updateTaskDetails,
    toggleTask,
    removeTask,
    undoRemoval,
    dismissUndo,
    replaceSavedTasks,
  };
}
