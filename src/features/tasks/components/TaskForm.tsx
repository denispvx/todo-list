import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { TaskFormProps } from '../contracts';
import { MAX_TASK_TITLE_LENGTH, type TaskDetailsError } from '../model';
import { formatDueDate } from '../planning';
import { TaskPlanningFields, type TaskPlanning } from './TaskPlanningFields';

const messages: Record<TaskDetailsError, string> = {
  empty: 'Введите название задачи.',
  'too-long': `Название должно быть не длиннее ${MAX_TASK_TITLE_LENGTH} символов.`,
  'invalid-date': 'Укажите существующую дату.',
  'invalid-planning': 'Проверьте параметры задачи.',
};

export function TaskForm({ onAdd, onAddPlanned, onBulkPaste, onOpenBulk }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<TaskDetailsError | null>(null);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planning, setPlanning] = useState<TaskPlanning>({ important: false, urgency: 'none', dueDate: '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hintId = useId();
  const errorId = useId();
  const planningId = useId();
  const hasPlanning = planning.important || planning.urgency !== 'none' || Boolean(planning.dueDate);
  const planningSummary = [
    planning.important ? 'Важно' : '',
    planning.urgency === 'urgent' ? 'Срочно' : planning.urgency === 'later' ? 'Не срочно' : '',
    planning.dueDate ? formatDueDate(planning.dueDate, false).label : '',
  ].filter(Boolean).join(' · ');

  useLayoutEffect(() => {
    if (error === 'invalid-date' && planningOpen) formRef.current?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
  }, [error, planningOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('empty');
      inputRef.current?.focus();
      return;
    }

    const dateInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="date"]');
    if (dateInput && !dateInput.validity.valid) {
      setError('invalid-date');
      dateInput.focus();
      return;
    }
    const result = onAddPlanned && (planningOpen || hasPlanning)
      ? onAddPlanned({ title, ...planning })
      : onAdd(title);

    if (!result.ok) {
      setError(result.error);
      if (result.error === 'invalid-date') setPlanningOpen(true);
      if (result.error === 'invalid-date' && dateInput) dateInput.focus();
      else inputRef.current?.focus();
      return;
    }

    setTitle('');
    setError(null);
    setPlanning({ important: false, urgency: 'none', dueDate: '' });
    setPlanningOpen(false);
    inputRef.current?.focus();
  }

  return (
    <form ref={formRef} className="task-form" onSubmit={handleSubmit} noValidate>
      <label className="sr-only" htmlFor="task-title">
        Новая задача
      </label>
      <div className={`task-compose${error ? ' task-compose--invalid' : ''}`}>
        <input
          ref={inputRef}
          id="task-title"
          className="task-input"
          type="text"
          name="title"
          placeholder="Новая задача"
          value={title}
          maxLength={MAX_TASK_TITLE_LENGTH}
          autoComplete="off"
          aria-invalid={error === 'empty' || error === 'too-long' ? true : undefined}
          aria-describedby={error && error !== 'invalid-date' ? errorId : hintId}
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData('text');
            if (onBulkPaste && /[\r\n]/.test(pastedText)) {
              event.preventDefault();
              onBulkPaste(pastedText);
            }
          }}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
        />
        {onOpenBulk && (
          <button className="bulk-trigger" type="button" onClick={onOpenBulk}>
            Списком
          </button>
        )}
        <button
          className="add-button"
          type="submit"
          aria-label="Добавить"
          title="Добавить задачу"
          disabled={title.trim().length === 0}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 4v12M4 10h12" />
          </svg>
        </button>
      </div>
      <p className="sr-only" id={hintId}>
        До {MAX_TASK_TITLE_LENGTH} символов. Enter, чтобы добавить.
      </p>
      {onAddPlanned && <>
        <div className="planning-toolbar">
          <button className={`planning-trigger${hasPlanning ? ' planning-trigger--set' : ''}`} type="button"
            aria-label="Срок и приоритет" aria-expanded={planningOpen} aria-controls={planningId}
            aria-describedby={hasPlanning && !planningOpen ? `${planningId}-summary` : undefined}
            onClick={() => {
              const dateInput = formRef.current?.querySelector<HTMLInputElement>('input[type="date"]');
              if (planningOpen && dateInput && !dateInput.validity.valid) {
                setError('invalid-date');
                dateInput.focus();
                return;
              }
              setPlanningOpen(!planningOpen);
            }}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d={planningOpen ? 'M4 10h12' : 'M10 4v12M4 10h12'} /></svg>
            Срок и приоритет
          </button>
          {hasPlanning && !planningOpen && <span className="planning-summary" id={`${planningId}-summary`}>{planningSummary}</span>}
        </div>
        {planningOpen && <div id={planningId}>
          <TaskPlanningFields value={planning} onChange={(value) => { setPlanning(value); setError(null); }}
            dateError={error === 'invalid-date' ? messages[error] : null} />
        </div>}
      </>}
      {((error && error !== 'invalid-date') || title.length >= 160) && (
        <div className="form-caption">
          {error && error !== 'invalid-date' && (
            <p className="field-error" id={errorId} role="alert">
              {messages[error]}
            </p>
          )}
          {title.length >= 160 && (
            <span className="character-count" aria-hidden="true">
              {title.length} / {MAX_TASK_TITLE_LENGTH}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
