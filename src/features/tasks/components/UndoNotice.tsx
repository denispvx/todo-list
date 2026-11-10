import type { UndoNoticeProps } from '../contracts';

export function UndoNotice({ title, onUndo, onDismiss }: UndoNoticeProps) {
  return (
    <aside className="undo-notice" aria-label="Отмена удаления">
      <div className="undo-message">
        <p className="undo-heading">Задача удалена</p>
        <p className="undo-title" title={title}>{title}</p>
      </div>
      <div className="undo-action">
        <button className="undo-button" type="button" onClick={onUndo}>Вернуть</button>
        <span className="undo-shortcut" aria-hidden="true">Ctrl / ⌘ Z</span>
      </div>
      <button
        className="undo-close"
        type="button"
        aria-label="Закрыть уведомление"
        onClick={onDismiss}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>
    </aside>
  );
}
