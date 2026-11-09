import { useEffect, useId, useRef } from 'react';
import type { StorageStatus } from '../features/tasks/model';
import { localDateKey } from '../features/tasks/planning';

export function WorkspaceHeader({ day, storageStatus }: Readonly<{ day: Date; storageStatus: StorageStatus }>) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const infoId = useId();
  const available = storageStatus === 'available';
  const date = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(day);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      const details = detailsRef.current;
      if (event.key === 'Escape' && !event.defaultPrevented && details?.open) {
        event.preventDefault();
        details.open = false;
        details.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <header className="site-header">
      <time className="header-date" dateTime={localDateKey(day)}>{date.charAt(0).toUpperCase() + date.slice(1)}</time>
      <details ref={detailsRef} className="data-info" onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}>
        <summary className={`data-info-trigger${available ? '' : ' data-info-trigger--warning'}`} aria-controls={infoId}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 9v5m0-8v.1" /></svg>
          {available ? 'О данных' : 'Не сохранено'}
        </summary>
        <div className="data-info-panel" id={infoId}>
          <h2>{available ? 'Сохраняется в браузере' : 'Изменения не сохранены'}</h2>
          {!available && <p className="data-info-error">Причина и доступные действия показаны над списком.</p>}
          <p>{available ? 'После обновления страницы задачи останутся в этом браузере.' : 'Пока изменения доступны в памяти страницы и могут исчезнуть после обновления.'}</p>
          <p>На другом устройстве будет отдельный список. Очистка данных сайта удалит сохранённые задачи.</p>
        </div>
      </details>
    </header>
  );
}
