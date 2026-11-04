import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { MAX_BATCH_TASKS, parseBatchDraft } from '../batch';
import { MAX_TASK_TITLE_LENGTH } from '../model';
import type { BatchPanelProps } from '../contracts';

const submitErrors = {
  empty: 'Добавьте хотя бы одну задачу.',
  'too-many': `Можно добавить не больше ${MAX_BATCH_TASKS} задач за один раз.`,
  invalid: 'Проверьте строки: название каждой задачи должно содержать от 1 до 200 символов.',
};

export function BatchPanel({ initialText, onSubmit, onClose }: BatchPanelProps) {
  const [text, setText] = useState(initialText);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headingId = useId();
  const textareaId = 'bulk-draft';
  const hintId = useId();
  const errorId = useId();
  const preview = parseBatchDraft(text);
  const draftError = preview.tooMany
    ? submitErrors['too-many']
    : preview.lines.some((line) => line.error !== null)
      ? submitErrors.invalid
      : preview.total === 0 && (text.trim().length > 0 || attempted)
        ? submitErrors.empty
        : null;
  const error = submissionError ?? draftError;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (!preview.valid) return;

    const result = onSubmit(text);
    if (!result.ok) setSubmissionError(submitErrors[result.error]);
  }

  return (
    <section
      className="batch-panel"
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        if (event.target instanceof Element && event.target.closest('dialog[open]')) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <h3 id={headingId}>Добавить списком</h3>
      <form onSubmit={handleSubmit} noValidate>
        <label className="batch-label" htmlFor={textareaId}>Список задач</label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          className="batch-textarea"
          rows={4}
          placeholder="Одна задача в строке"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
          onChange={(event) => {
            setText(event.target.value);
            setSubmissionError(null);
            setAttempted(false);
          }}
        />
        <p className="batch-hint" id={hintId}>
          До {MAX_BATCH_TASKS} задач, до {MAX_TASK_TITLE_LENGTH} символов в каждой.
        </p>
        {error && <p className="batch-error" id={errorId} role="alert">{error}</p>}
        {preview.total > 0 && (
          <div className="batch-preview-wrap">
            <p className="batch-preview-count" role="status" aria-live="polite">
              В списке: {preview.total}
            </p>
            <ol className="batch-preview" role="list" aria-label="Предпросмотр задач">
              {preview.lines.slice(0, MAX_BATCH_TASKS).map((line) => (
                <li
                  key={line.lineNumber}
                  className={`batch-preview-line${line.error ? ' batch-preview-line--invalid' : ''}`}
                >
                  <span className="batch-line-number" aria-label={`Строка ${line.lineNumber}`}>
                    {line.lineNumber}.
                  </span>
                  <span className="batch-line-content">
                    <span>{line.title}</span>
                    {line.error && (
                      <span className="batch-line-error">
                        {line.error === 'too-long' ? 'Больше 200 символов' : 'Нет названия'}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="batch-actions">
          <button className="button-primary" type="submit" disabled={!preview.valid}>
            Добавить задачи
          </button>
          <button className="button-quiet" type="button" onClick={onClose}>Отмена</button>
        </div>
      </form>
    </section>
  );
}
