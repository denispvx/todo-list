import { useState } from 'react';
import { TaskForm, TaskList } from '../features/tasks/components';
import { validateTaskTitle } from '../features/tasks/model';
import type { AddTaskResult, Task } from '../features/tasks/model';

function taskCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? 'задач'
    : last === 1 ? 'задача' : last >= 2 && last <= 4 ? 'задачи' : 'задач';
  return `${count} ${word}`;
}

export default function App() {
  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const completedCount = tasks.filter((task) => task.completed).length;

  function addTask(input: string): AddTaskResult {
    const result = validateTaskTitle(input);
    if (!result.ok) return result;
    const task: Task = { id: crypto.randomUUID(), title: result.title, completed: false };
    setTasks((current) => [task, ...current]);
    setAnnouncement(`Добавлена задача: ${task.title}`);
    return { ok: true };
  }

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id
      ? { ...task, completed: !task.completed } : task));
  }

  function removeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    setTasks((current) => current.filter((item) => item.id !== id));
    if (task) setAnnouncement(`Удалена задача: ${task.title}`);
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
          <p className="eyebrow">ПО ПОРЯДКУ, БЕЗ СПЕШКИ</p>
          <h1>Мои задачи<span className="heading-dot">.</span></h1>
          <p className="page-description">Всё, что хочется сделать. В одном месте.</p>
        </div>
        <TaskForm onAdd={addTask} />
        <section className="list-panel" aria-labelledby="list-heading">
          <div className="list-heading">
            <h2 id="list-heading">Список задач</h2>
            <span className="list-count">{taskCount(tasks.length)}</span>
          </div>
          <TaskList tasks={tasks} onToggle={toggleTask} onRemove={removeTask} />
        </section>
        <footer className="workspace-footer">
          <span>{completedCount > 0 ? `Выполнено ${completedCount} из ${tasks.length}` : 'Маленькие шаги — тоже движение.'}</span>
          <span className="prototype-note">Предпросмотр · до обновления страницы</span>
        </footer>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </main>
    </div>
  );
}
