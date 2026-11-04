import type { Task } from '../model';
import { formatDueDate } from '../planning';
import '../../../styles/task-planning.css';

export function TaskMeta({ task, id }: Readonly<{ task: Task; id: string }>) {
  if (!task.important && (!task.urgency || task.urgency === 'none') && !task.dueDate) return null;
  const due = task.dueDate ? formatDueDate(task.dueDate, task.completed) : null;
  return (
    <span className="task-meta" id={id}>
      {task.important && <span className="task-meta-important">Важно</span>}
      {task.urgency === 'urgent' && <span className={task.completed ? '' : 'task-meta-urgent'}>Срочно</span>}
      {task.urgency === 'later' && <span>Не срочно</span>}
      {due && <time dateTime={task.dueDate} className={due.overdue ? 'task-meta-overdue' : ''}>{due.label}</time>}
    </span>
  );
}
