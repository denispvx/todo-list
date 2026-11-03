import { useId } from 'react';
import type { TaskItemProps } from '../contracts';

export function TaskItem({ task, onToggle, onRemove }: TaskItemProps) {
  const checkboxId = useId();

  return (
    <li
      className={`task-item${task.completed ? ' task-item--completed' : ''}`}
      data-task-id={task.id}
    >
      <label className="task-label" htmlFor={checkboxId}>
        <input
          id={checkboxId}
          className="task-checkbox"
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
        />
        <span className="task-title">{task.title}</span>
      </label>
      <button
        className="delete-button"
        type="button"
        aria-label={`Удалить задачу «${task.title}»`}
        title="Удалить задачу"
        onClick={() => onRemove(task.id)}
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.5 5.5h13M7.5 5.5v-2h5v2M5 5.5l.75 11h8.5l.75-11M8 8.5v5M12 8.5v5" />
        </svg>
      </button>
    </li>
  );
}
