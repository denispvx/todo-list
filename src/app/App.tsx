import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BatchPanel, StorageNotice, TaskForm, TaskList, UndoNotice } from '../features/tasks/components';
import { useTasks } from '../features/tasks/useTasks';
import { parseBatchDraft } from '../features/tasks/batch';
import type { AddTaskResult, BatchAddResult, TaskDetails, TaskDetailsResult } from '../features/tasks/model';
import { FocusPanel } from '../features/focus/FocusPanel';
import { useFocusSession } from '../features/focus/useFocusSession';
import { TaskFilters, type TaskFilter } from '../features/tasks/components/TaskFilters';
import { sortTasks, type TaskOrder } from '../features/tasks/planning';
import { useLocalDay } from '../features/tasks/useLocalDay';
import { WorkspaceHeader } from './WorkspaceHeader';

function taskCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? 'задач'
    : last === 1 ? 'задача' : last >= 2 && last <= 4 ? 'задачи' : 'задач';
  return `${count} ${word}`;
}

export default function App() {
  const { tasks, storageStatus, addTask, addTasks, addPlannedTask, updateTask, updateTaskDetails, toggleTask, removeTask, replaceSavedTasks,
    lastRemovedTask, undoRemoval, dismissUndo } = useTasks();
  const focus = useFocusSession();
  const [focusOpen, setFocusOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkRevision, setBulkRevision] = useState(0);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [taskOrder, setTaskOrder] = useState<TaskOrder>('manual');
  const today = useLocalDay();
  const restoredTaskId = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', revision: 0 });
  const [replacementFailed, setReplacementFailed] = useState(false);
  const completedCount = tasks.filter((task) => task.completed).length;

  const announce = useCallback((text: string) => {
    setAnnouncement((current) => ({ text, revision: current.revision + 1 }));
  }, []);

  const handleUndo = useCallback(() => {
    const task = lastRemovedTask;
    if (!task || !undoRemoval()) return false;
    setTaskFilter('all');
    restoredTaskId.current = task.id;
    announce(`Возвращена задача: ${task.title}`);
    return true;
  }, [lastRemovedTask, undoRemoval, announce]);

  useLayoutEffect(() => {
    if (!restoredTaskId.current) return;
    const row = Array.from(document.querySelectorAll('[data-task-id]'))
      .find((element) => element.getAttribute('data-task-id') === restoredTaskId.current);
    const target = row?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (target) target.focus();
    else document.getElementById('task-title')?.focus();
    restoredTaskId.current = null;
  }, [tasks]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (focusOpen || bulkOpen || event.defaultPrevented || event.altKey || event.shiftKey
        || !(event.ctrlKey || event.metaKey)
        || (event.key.toLowerCase() !== 'z' && event.code !== 'KeyZ')) return;
      const target = event.target;
      if (target instanceof HTMLTextAreaElement
        || (target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(target.type))
        || (target instanceof Element && target.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"]'))) return;
      if (handleUndo()) event.preventDefault();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, focusOpen, bulkOpen]);

  function handleAdd(input: string): AddTaskResult {
    const result = addTask(input);
    if (result.ok) {
      setTaskFilter('all');
      announce(`Добавлена задача: ${input.trim()}`);
    }
    return result;
  }

  function handleAddPlanned(details: TaskDetails): TaskDetailsResult {
    const result = addPlannedTask(details);
    if (result.ok) {
      setTaskFilter('all');
      announce(`Добавлена задача: ${details.title.trim()}`);
    }
    return result;
  }

  function handleRemove(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (taskFilter !== 'all' && visibleTasks.length === 1
      && document.activeElement?.closest('[data-task-id]')?.getAttribute('data-task-id') === id) {
      restoredTaskId.current = 'task-input';
    }
    removeTask(id);
    if (focus.taskId === id) focus.clear();
    if (task) announce(`Удалена задача: ${task.title}`);
  }

  function handleToggle(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (taskFilter !== 'all' && document.activeElement?.closest('[data-task-id]')?.getAttribute('data-task-id') === id) {
      const index = visibleTasks.findIndex((item) => item.id === id);
      restoredTaskId.current = visibleTasks[index + 1]?.id ?? visibleTasks[index - 1]?.id ?? 'task-input';
    }
    toggleTask(id);
    if (task && !task.completed && focus.taskId === id) focus.clear();
  }

  function openBulk(text = '') {
    if (bulkOpen && !text) {
      document.getElementById('bulk-draft')?.focus();
      return;
    }
    setBulkText(text);
    setBulkRevision((current) => current + 1);
    setBulkOpen(true);
  }

  function closeBulk() {
    setBulkOpen(false);
    document.getElementById('task-title')?.focus();
  }

  function submitBulk(text: string): BatchAddResult {
    const preview = parseBatchDraft(text);
    if (!preview.valid) return { ok: false, error: preview.tooMany ? 'too-many' : preview.total === 0 ? 'empty' : 'invalid' };
    const result = addTasks(preview.lines.map((line) => line.title));
    if (result.ok) {
      setTaskFilter('all');
      closeBulk();
      announce(`Добавлено: ${taskCount(result.count)}`);
    }
    return result;
  }

  const orderedTasks = sortTasks(tasks, taskOrder);
  const unfinished = orderedTasks.filter((task) => !task.completed);
  const visibleTasks = taskFilter === 'all' ? orderedTasks : orderedTasks.filter((task) => task.completed === (taskFilter === 'completed'));
  const focusTask = unfinished.find((task) => task.id === focus.taskId) ?? null;

  function openFocus() {
    const task = focusTask ?? unfinished[0];
    if (!task) return;
    focus.selectTask(task.id);
    setFocusOpen(true);
  }

  function nextFocus() {
    if (unfinished.length < 2) return;
    const index = unfinished.findIndex((task) => task.id === focus.taskId);
    const next = unfinished[(index + 1) % unfinished.length];
    if (next) focus.selectTask(next.id);
  }

  function completeFocus() {
    if (!focusTask) return;
    toggleTask(focusTask.id);
    announce(`Выполнена задача: ${focusTask.title}`);
    const next = unfinished.find((task) => task.id !== focusTask.id);
    if (next) focus.selectTask(next.id);
    else focus.clear();
  }

  function handleReplace() {
    const result = replaceSavedTasks();
    setReplacementFailed(!result.ok);
    if (result.ok) document.getElementById('task-title')?.focus();
  }

  return (
    <div className="app-shell">
      <WorkspaceHeader day={today} storageStatus={storageStatus} />
      <main className="workspace">
        <div className="page-heading">
          <h1><span>Мои</span>{' '}<em>задачи<span className="heading-dot">.</span></em></h1>
          {tasks.length > 0 && <div className="overview">
            <div
              className={`progress-summary${completedCount === tasks.length ? ' is-complete' : ''}`}
              role="progressbar"
              aria-label="Выполнение задач"
              aria-valuemin={0}
              aria-valuemax={tasks.length}
              aria-valuenow={completedCount}
              aria-valuetext={`Выполнено ${completedCount} из ${tasks.length}; всего ${taskCount(tasks.length)}`}
            >
              <div className="progress-figure">
                <span className="progress-current">{String(completedCount).padStart(2, '0')}</span>
                <span className="progress-divider">/</span>
                <span className="progress-total">{String(tasks.length).padStart(2, '0')}</span>
              </div>
              <p className="progress-caption">{completedCount === tasks.length ? 'Всё сделано' : 'выполнено'}</p>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${completedCount / tasks.length * 100}%` }} />
              </div>
            </div>
            {unfinished.length > 0 && (
              <button className="focus-entry" type="button" onClick={openFocus} aria-label="Режим фокуса"
                title="Одна задача и необязательный таймер на 25 минут">
                {focus.running && focusTask
                  ? `${String(Math.floor(focus.remainingSeconds / 60)).padStart(2, '0')}:${String(focus.remainingSeconds % 60).padStart(2, '0')}`
                  : 'Фокус'}
              </button>
            )}
          </div>}
        </div>
        <div className="task-workspace">
          <TaskForm onAdd={handleAdd} onAddPlanned={handleAddPlanned} onBulkPaste={openBulk} onOpenBulk={() => openBulk()} />
          <StorageNotice status={storageStatus} replacementFailed={replacementFailed} onReplace={handleReplace} />
          {bulkOpen && <BatchPanel key={bulkRevision} initialText={bulkText} onSubmit={submitBulk} onClose={closeBulk} />}
          <section className="list-panel" aria-labelledby="list-heading">
            <h2 id="list-heading" className="sr-only">Список задач</h2>
            {tasks.length > 0 && <div className="task-toolbar">
              <TaskFilters tasks={tasks} value={taskFilter} onChange={setTaskFilter} />
              <label className={`task-order${taskOrder === 'manual' ? '' : ' task-order--active'}`}
                title={`Порядок задач: ${taskOrder === 'manual' ? 'как добавлены' : taskOrder === 'priority' ? 'сначала важные' : 'по сроку'}`}>
                <span className="sr-only">Порядок задач</span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h10M3 10h7M3 15h4m8-10v11m-3-3 3 3 3-3" /></svg>
                <select value={taskOrder} onChange={(event) => setTaskOrder(event.target.value as TaskOrder)}>
                  <option value="manual">Как добавлены</option>
                  <option value="priority">Сначала важные</option>
                  <option value="due-date">По сроку</option>
                </select>
              </label>
            </div>}
            {tasks.length > 0 && visibleTasks.length === 0 ? (
              <div className="filtered-empty" role="status">
                <p>{taskFilter === 'active' ? 'Всё сделано.' : 'Здесь будут выполненные задачи.'}</p>
                <button type="button" onClick={() => setTaskFilter('all')}>Показать все</button>
              </div>
            ) : <TaskList tasks={visibleTasks} onToggle={handleToggle} onRemove={handleRemove} onUpdate={updateTask} onUpdateDetails={updateTaskDetails} />}
          </section>
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {/* Replace the child so repeated identical messages update the live region. */}
          <span key={announcement.revision}>{announcement.text}</span>
        </p>
      </main>
      {lastRemovedTask && <UndoNotice title={lastRemovedTask.title} onUndo={handleUndo} onDismiss={() => {
        dismissUndo();
        document.getElementById('task-title')?.focus();
      }} />}
      <FocusPanel open={focusOpen} task={focusTask} remainingSeconds={focus.remainingSeconds}
        running={focus.running} finished={focus.remainingSeconds === 0} persistenceFailed={focus.persistenceFailed}
        canSwitch={unfinished.length > 1} onStart={focus.start} onPause={focus.pause} onReset={focus.reset}
        onComplete={completeFocus} onNext={nextFocus} onClose={() => setFocusOpen(false)} />
    </div>
  );
}
