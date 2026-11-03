import type { AddTaskResult, StorageStatus, Task } from './model';

export interface TaskFormProps {
  onAdd(title: string): AddTaskResult;
}

export interface TaskItemProps {
  task: Task;
  onToggle(id: Task['id']): void;
  onRemove(id: Task['id']): void;
}

export interface TaskListProps {
  tasks: readonly Task[];
  onToggle(id: Task['id']): void;
  onRemove(id: Task['id']): void;
}

export interface StorageNoticeProps {
  status: StorageStatus;
  replacementFailed?: boolean;
  onReplace(): void;
}
