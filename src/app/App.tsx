import { useState } from 'react';
import { StorageNotice, TaskForm, TaskList } from '../features/tasks/components';
import { useTasks } from '../features/tasks/useTasks';
import type { AddTaskResult } from '../features/tasks/model';

function taskCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? 'задач'
    : last === 1 ? 'задача' : last >= 2 && last <= 4 ? 'задачи' : 'задач';
  return `${count} ${word}`;
}

export default function App() {
  const { tasks, storageStatus, addTask, toggleTask, removeTask, replaceSavedTasks } = useTasks();
  const [announcement, setAnnouncement] = useState({ text: '', revision: 0 });
  const [replacementFailed, setReplacementFailed] = useState(false);
  const completedCount = tasks.filter((task) => task.completed).length;

  function announce(text: string) {
    setAnnouncement((current) => ({ text, revision: current.revision + 1 }));
  }

  function handleAdd(input: string): AddTaskResult {
    const result = addTask(input);
    if (result.ok) announce(`Добавлена задача: ${input.trim()}`);
    return result;
  }

  function handleRemove(id: string) {
    const task = tasks.find((item) => item.id === id);
    removeTask(id);
    if (task) announce(`Удалена задача: ${task.title}`);
  }

  function handleReplace() {
    const result = replaceSavedTasks();
    setReplacementFailed(!result.ok);
    if (result.ok) document.getElementById('task-title')?.focus();
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Список — главная">
          <span>список<span className="brand-dot">.</span></span>
        </a>
        <span
          className={`save-indicator${storageStatus === 'available' ? '' : ' save-indicator--warning'}`}
          title={storageStatus === 'available' ? 'Задачи сохраняются в этом браузере' : 'Изменения пока не сохранены'}
        >
          <span className="save-indicator-dot" aria-hidden="true" />
          {storageStatus === 'available' ? 'На устройстве' : 'Не сохранено'}
        </span>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <h1><span>Мои</span>{' '}<em>задачи<span className="heading-dot">.</span></em></h1>
          {tasks.length > 0 && (
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
          )}
        </div>
        <div className="task-workspace">
          <TaskForm onAdd={handleAdd} />
          <StorageNotice status={storageStatus} replacementFailed={replacementFailed} onReplace={handleReplace} />
          <section className="list-panel" aria-labelledby="list-heading">
            <h2 id="list-heading" className="sr-only">Список задач</h2>
            <TaskList tasks={tasks} onToggle={toggleTask} onRemove={handleRemove} />
          </section>
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {/* Replace the child so repeated identical messages update the live region. */}
          <span key={announcement.revision}>{announcement.text}</span>
        </p>
      </main>
    </div>
  );
}
