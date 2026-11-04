import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { TaskItemProps } from '../contracts';
import { MAX_TASK_TITLE_LENGTH, type TitleError } from '../model';
import '../../../styles/task-edit.css';

export function TaskItem({ task, onToggle, onRemove, onUpdate }: TaskItemProps) {
  const checkboxId = useId();
  const editId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [error, setError] = useState<TitleError | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useLayoutEffect(() => {
    if (editing) {
      fieldRef.current?.focus();
      fieldRef.current?.select();
    } else if (restoreFocus.current) {
      buttonRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [editing]);

  function finishEditing() {
    restoreFocus.current = true;
    setEditing(false);
    setError(null);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!onUpdate) return;
    const result = onUpdate(task.id, draft);
    if (result.ok) finishEditing();
    else {
      setError(result.error);
      fieldRef.current?.focus();
    }
  }

  return (
    <li
      className={`task-item${task.completed ? ' task-item--completed' : ''}`}
      data-task-id={task.id}
    >
      {editing ? (
        <form className="task-edit-form" onSubmit={save} onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            finishEditing();
          }
        }}>
          <label className="sr-only" htmlFor={editId}>Название задачи</label>
          <textarea ref={fieldRef} id={editId} className="task-edit-input" rows={2}
            maxLength={MAX_TASK_TITLE_LENGTH} value={draft} aria-invalid={Boolean(error)}
            aria-describedby={`${editId}-hint${error ? ` ${editId}-error` : ''}`}
            onChange={(event) => { setDraft(event.target.value); setError(null); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} />
          <span className="sr-only" id={`${editId}-hint`}>До 200 символов. Enter — сохранить, Escape — отменить.</span>
          {error && <p className="task-edit-error" id={`${editId}-error`} role="alert">
            {error === 'empty' ? 'Введите название задачи.' : 'Не больше 200 символов.'}
          </p>}
          <div className="task-edit-actions">
            <button className="button-primary" type="submit">Сохранить</button>
            <button className="button-quiet" type="button" onClick={finishEditing}>Отмена</button>
          </div>
        </form>
      ) : (
        <>
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
          <div className="task-row-actions">
            {onUpdate && (
              <button
                ref={buttonRef}
                className="delete-button edit-button"
                type="button"
                aria-label={`Изменить задачу «${task.title}»`}
                title="Изменить"
                onClick={() => { setDraft(task.title); setError(null); setEditing(true); }}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m12.5 3.5 4 4M3.5 16.5l1-4L13 4a2.1 2.1 0 0 1 3 3l-8.5 8.5-4 1Z" />
                </svg>
              </button>
            )}
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
          </div>
        </>
      )}
    </li>
  );
}
