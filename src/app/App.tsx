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
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="currentColor" />
            <path d="m9 16 4.5 4.5L23 11" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>список</span>
        </a>
        <span className="header-note">Личное пространство</span>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <p className="eyebrow">ЛИЧНЫЙ СПИСОК</p>
          <h1>Мои задачи<span className="heading-dot">.</span></h1>
          <p className="page-description">Всё, что хочется сделать. В одном месте.</p>
        </div>
        <TaskForm onAdd={handleAdd} />
        <section className="list-panel" aria-labelledby="list-heading">
          <div className="list-heading">
            <h2 id="list-heading">Список задач</h2>
            <span className="list-count">{taskCount(tasks.length)}</span>
          </div>
          <TaskList tasks={tasks} onToggle={toggleTask} onRemove={handleRemove} />
        </section>
        <StorageNotice status={storageStatus} replacementFailed={replacementFailed} onReplace={handleReplace} />
        <footer className="workspace-footer">
          {tasks.length > 0 && <span>{completedCount === tasks.length
            ? 'Все задачи выполнены'
            : `Выполнено ${completedCount} из ${tasks.length}`}</span>}
          <span className="storage-hint">{storageStatus === 'available'
            ? 'Задачи сохраняются в этом браузере'
            : 'Изменения пока не сохранены'}</span>
        </footer>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {/* Replace the child so repeated identical messages update the live region. */}
          <span key={announcement.revision}>{announcement.text}</span>
        </p>
      </main>
    </div>
  );
}
