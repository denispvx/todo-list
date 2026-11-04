import type { StorageNoticeProps } from '../contracts';

const storageMessages = {
  invalid:
    'Не удалось восстановить сохранённый список. Новые задачи пока не сохраняются.',
  unavailable:
    'Хранилище браузера недоступно. После обновления страницы задачи могут исчезнуть.',
  'write-error':
    'Изменения не удалось сохранить. После обновления страницы они могут исчезнуть.',
};

export function StorageNotice({ status, replacementFailed = false, onReplace }: StorageNoticeProps) {
  if (status === 'available') return null;

  return (
    <div
      className="storage-notice"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p>{storageMessages[status]}</p>
      {status === 'invalid' && (
        <>
          <p className="storage-notice-description">
            Сохранение текущего списка заменит прежние данные.
          </p>
          {replacementFailed && (
            <p className="storage-notice-error" role="alert">
              Не удалось сохранить текущий список. Попробуйте ещё раз.
            </p>
          )}
          <button
            className="storage-recovery-button"
            type="button"
            onClick={onReplace}
          >
            Сохранить текущий список
          </button>
        </>
      )}
    </div>
  );
}
