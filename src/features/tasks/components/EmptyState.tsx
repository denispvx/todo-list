export function EmptyState() {
  return (
    <div className="empty-state">
      <span className="empty-state-mark" aria-hidden="true">—</span>
      <h3>Пока нет задач</h3>
      <p>Добавьте первую задачу выше.</p>
    </div>
  );
}
