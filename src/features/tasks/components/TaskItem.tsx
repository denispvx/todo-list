import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { TaskItemProps } from '../contracts';
import { MAX_TASK_TITLE_LENGTH, type TaskDetailsError } from '../model';
import { TaskPlanningFields, type TaskPlanning } from './TaskPlanningFields';
import { TaskMeta } from './TaskMeta';
import '../../../styles/task-edit.css';

export function TaskItem({ task, onToggle, onRemove, onUpdate, onUpdateDetails }: TaskItemProps) {
  const checkboxId = useId();
  const editId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [error, setError] = useState<TaskDetailsError | null>(null);
  const [planning, setPlanning] = useState<TaskPlanning>({ important: false, urgency: 'none', dueDate: '' });
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const metaId = useId();
  const hasMeta = task.important || (task.urgency && task.urgency !== 'none') || task.dueDate;
  const messages: Record<TaskDetailsError, string> = {
    empty: 'Введите название задачи.',
    'too-long': 'Не больше 200 символов.',
    'invalid-date': 'Укажите существующую дату.',
    'invalid-planning': 'Проверьте параметры задачи.',
  };

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
    if (!onUpdate && !onUpdateDetails) return;
    const form = event.currentTarget as HTMLFormElement;
    const dateInput = form.querySelector<HTMLInputElement>('input[type="date"]');
    if (dateInput?.validity.badInput) {
      setError('invalid-date');
      dateInput.focus();
      return;
    }
    const result = onUpdateDetails
      ? onUpdateDetails(task.id, { title: draft, ...planning })
      : onUpdate!(task.id, draft);
    if (result.ok) finishEditing();
    else {
      setError(result.error);
      if (result.error === 'invalid-date' && dateInput) dateInput.focus();
      else fieldRef.current?.focus();
    }
  }

  return (
    <li
      className={`task-item${task.completed ? ' task-item--completed' : ''}`}
      data-task-id={task.id}
    >
      {editing ? (
        <form className="task-edit-form" onSubmit={save} noValidate onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            finishEditing();
          }
        }}>
          <label className="sr-only" htmlFor={editId}>Название задачи</label>
          <textarea ref={fieldRef} id={editId} className="task-edit-input" rows={2}
            maxLength={MAX_TASK_TITLE_LENGTH} value={draft} aria-invalid={error === 'empty' || error === 'too-long'}
            aria-describedby={`${editId}-hint${error && error !== 'invalid-date' ? ` ${editId}-error` : ''}`}
            onChange={(event) => { setDraft(event.target.value); setError(null); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} />
          <span className="sr-only" id={`${editId}-hint`}>До 200 символов. Enter — сохранить, Escape — отменить.</span>
          {error && error !== 'invalid-date' && <p className="task-edit-error" id={`${editId}-error`} role="alert">
            {messages[error]}
          </p>}
          {onUpdateDetails && <TaskPlanningFields value={planning}
            onChange={(value) => { setPlanning(value); setError(null); }}
            dateError={error === 'invalid-date' ? messages[error] : null} />}
          <div className="task-edit-actions">
            <button className="button-primary" type="submit">Сохранить</button>
            <button className="button-quiet" type="button" onClick={finishEditing}>Отмена</button>
          </div>
        </form>
      ) : (
        <>
          <div className="task-main">
            <label className="task-label" htmlFor={checkboxId}>
            <input
              id={checkboxId}
              className="task-checkbox"
              type="checkbox"
              checked={task.completed}
              aria-describedby={hasMeta ? metaId : undefined}
              onChange={() => onToggle(task.id)}
            />
            <span className="task-title">{task.title}</span>
            </label>
            <TaskMeta task={task} id={metaId} />
          </div>
          <div className="task-row-actions">
            {(onUpdate || onUpdateDetails) && (
              <button
                ref={buttonRef}
                className="delete-button edit-button"
                type="button"
                aria-label={`Изменить задачу «${task.title}»`}
                title="Изменить"
                onClick={() => {
                  setDraft(task.title);
                  setPlanning({ important: task.important ?? false, urgency: task.urgency ?? 'none', dueDate: task.dueDate ?? '' });
                  setError(null);
                  setEditing(true);
                }}
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
