import type { Task } from '../model';

export type TaskFilter = 'all' | 'active' | 'completed';

type Props = Readonly<{
  tasks: readonly Task[];
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
}>;

export function TaskFilters({ tasks, value, onChange }: Props) {
  const completed = tasks.filter((task) => task.completed).length;
  const options = [
    { value: 'all', label: 'Все', count: tasks.length },
    { value: 'active', label: 'В работе', count: tasks.length - completed },
    { value: 'completed', label: 'Готовые', count: completed },
  ] as const;

  return (
    <div className="task-filters" role="group" aria-label="Показать задачи">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}>
          {option.label}<span aria-hidden="true">{option.count}</span>
        </button>
      ))}
    </div>
  );
}
