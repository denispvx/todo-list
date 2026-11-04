import { useEffect, useId, useRef } from 'react';
import type { FocusPanelProps } from './contracts';

export function FocusPanel({
  open,
  task,
  remainingSeconds,
  running,
  finished,
  persistenceFailed,
  canSwitch,
  onStart,
  onPause,
  onReset,
  onComplete,
  onNext,
  onClose,
}: FocusPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const seconds = Math.max(0, Math.floor(remainingSeconds));
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsText = String(seconds % 60).padStart(2, '0');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      else document.getElementById('task-title')?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open && !task) doneButtonRef.current?.focus();
  }, [open, task]);

  return (
    <dialog
      ref={dialogRef}
      className="focus-dialog"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <h2 className="sr-only" id={headingId}>Режим фокуса</h2>
      <header className="focus-header">
        <span className="focus-wordmark">Фокус<span>.</span></span>
        <button
          className="focus-close"
          type="button"
          aria-label="Закрыть режим фокуса"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      {task ? (
        <div className="focus-content">
          <h3 className="focus-task">{task.title}</h3>
          <div className="focus-timer" role="timer" aria-live="off" aria-label={`Осталось ${minutesText} мин ${secondsText} сек`}>
            {minutesText}<span>:</span>{secondsText}
          </div>
          {finished && <p className="focus-finished" role="status">Сессия завершена</p>}
          <div className="focus-timer-actions">
            <button className="button-primary" type="button" onClick={running ? onPause : onStart}>
              {running ? 'Пауза' : finished ? 'Начать заново' : 'Начать'}
            </button>
            <button className="button-quiet" type="button" onClick={onReset}>Сбросить</button>
          </div>
          <div className="focus-task-actions">
            <button className="focus-complete" type="button" onClick={onComplete}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>
              Готово
            </button>
            <button className="button-quiet" type="button" onClick={onNext} disabled={!canSwitch}>
              Следующая
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h14m-5-5 5 5-5 5" /></svg>
            </button>
          </div>
          {running && <p className="focus-note">Таймер продолжит идти после закрытия.</p>}
          {persistenceFailed && (
            <p className="focus-warning" role="status">
              Таймер работает без сохранения. После обновления страницы время может сброситься.
            </p>
          )}
        </div>
      ) : (
        <div className="focus-content focus-content--done">
          <span className="focus-done-mark" aria-hidden="true">✓</span>
          <h3 className="focus-task">Все задачи выполнены</h3>
          <button ref={doneButtonRef} className="button-primary" type="button" onClick={onClose}>
            Вернуться к списку
          </button>
        </div>
      )}
    </dialog>
  );
}
