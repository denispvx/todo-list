import { useId, useRef, useState, type FormEvent } from 'react';
import type { TaskFormProps } from '../contracts';
import { MAX_TASK_TITLE_LENGTH } from '../model';

export function TaskForm({ onAdd }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('Введите название задачи.');
      inputRef.current?.focus();
      return;
    }

    const result = onAdd(title);

    if (!result.ok) {
      setError(
        result.error === 'too-long'
          ? `Название должно быть не длиннее ${MAX_TASK_TITLE_LENGTH} символов.`
          : 'Введите название задачи.',
      );
      inputRef.current?.focus();
      return;
    }

    setTitle('');
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <label className="field-label" htmlFor="task-title">
        Новая задача
      </label>
      <div className={`task-compose${error ? ' task-compose--invalid' : ''}`}>
        <input
          ref={inputRef}
          id="task-title"
          className="task-input"
          type="text"
          name="title"
          placeholder="Что нужно сделать?"
          value={title}
          maxLength={MAX_TASK_TITLE_LENGTH}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hintId}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
        />
        <button
          className="add-button"
          type="submit"
          disabled={title.trim().length === 0}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 4v12M4 10h12" />
          </svg>
          Добавить
        </button>
      </div>
      <div className="form-caption">
        {error ? (
          <p className="field-error" id={errorId} role="alert">
            {error}
          </p>
        ) : (
          <p id={hintId}>До {MAX_TASK_TITLE_LENGTH} символов</p>
        )}
        <span className="keyboard-hint" aria-hidden="true">
          <kbd>Enter</kbd> чтобы добавить
        </span>
      </div>
    </form>
  );
}
