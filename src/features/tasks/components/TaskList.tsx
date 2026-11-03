import { useLayoutEffect, useRef } from 'react';
import type { TaskListProps } from '../contracts';
import type { Task } from '../model';
import { EmptyState } from './EmptyState';
import { TaskItem } from './TaskItem';

type PendingFocus = { id: Task['id'] | null };

export function TaskList({ tasks, onToggle, onRemove }: TaskListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;

    const targetId = pendingFocus.current.id;
    const targetRow = Array.from(listRef.current?.children ?? []).find(
      (row) => row.getAttribute('data-task-id') === targetId,
    );
    const checkbox = targetRow?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );

    if (checkbox) checkbox.focus();
    else document.getElementById('task-title')?.focus();

    pendingFocus.current = null;
  }, [tasks]);

  function handleRemove(id: Task['id']) {
    const currentRow = Array.from(listRef.current?.children ?? []).find(
      (row) => row.getAttribute('data-task-id') === id,
    );

    if (currentRow?.contains(document.activeElement)) {
      const index = tasks.findIndex((task) => task.id === id);
      pendingFocus.current = {
        id: tasks[index + 1]?.id ?? tasks[index - 1]?.id ?? null,
      };
    }

    onRemove(id);
  }

  if (tasks.length === 0) return <EmptyState />;

  return (
    <ul className="task-list" ref={listRef} aria-label="Список задач">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onRemove={handleRemove}
        />
      ))}
    </ul>
  );
}
