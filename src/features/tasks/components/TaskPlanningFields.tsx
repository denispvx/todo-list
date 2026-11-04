import { useId, useRef } from 'react';
import type { TaskDetails } from '../model';
import '../../../styles/task-planning.css';

export type TaskPlanning = Omit<TaskDetails, 'title'>;

type Props = Readonly<{
  value: TaskPlanning;
  onChange: (value: TaskPlanning) => void;
  dateError?: string | null;
}>;

export function TaskPlanningFields({ value, onChange, dateError }: Props) {
  const id = useId();
  const dateRef = useRef<HTMLInputElement>(null);
  return (
    <fieldset className="planning-fields">
      <legend className="sr-only">Планирование задачи</legend>
      <label className="planning-important">
        <input type="checkbox" checked={value.important}
          onChange={(event) => onChange({ ...value, important: event.target.checked })} />
        <span>Важно</span>
      </label>
      <div className="planning-field">
        <label htmlFor={`${id}-urgency`}>Срочность</label>
        <select id={`${id}-urgency`} value={value.urgency}
          onChange={(event) => onChange({ ...value, urgency: event.target.value as TaskPlanning['urgency'] })}>
          <option value="none">Не задана</option>
          <option value="urgent">Срочно</option>
          <option value="later">Не срочно</option>
        </select>
      </div>
      <div className="planning-field">
        <label htmlFor={`${id}-date`}>Срок</label>
        <div className="planning-date">
          <input ref={dateRef} id={`${id}-date`} type="date" min="0001-01-01" max="9999-12-31"
            value={value.dueDate} aria-invalid={Boolean(dateError)}
            aria-describedby={dateError ? `${id}-date-error` : undefined}
            onChange={(event) => onChange({ ...value, dueDate: event.target.value })} />
          {value.dueDate && <button type="button" className="planning-clear"
            aria-label="Убрать срок" title="Убрать срок" onClick={() => {
              onChange({ ...value, dueDate: '' });
              dateRef.current?.focus();
            }}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>}
        </div>
        {dateError && <p id={`${id}-date-error`} className="planning-error" role="alert">{dateError}</p>}
      </div>
    </fieldset>
  );
}
