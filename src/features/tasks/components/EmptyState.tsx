export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <rect x="7" y="5" width="18" height="23" rx="3" />
          <path d="m11.5 14 2 2 4-4M12 21h8M12 5V3.5h8V5" />
        </svg>
      </div>
      <h3>Пока нет задач</h3>
      <p>Добавьте первую задачу в поле выше.</p>
    </div>
  );
}
