import type { AddTaskResult, BatchAddResult, StorageStatus, Task, TaskDetails, TaskDetailsResult } from './model';

export interface TaskFormProps {
  onAdd(title: string): AddTaskResult;
  onAddPlanned?(details: TaskDetails): TaskDetailsResult;
  onBulkPaste?(text: string): void;
  onOpenBulk?(): void;
}

export interface BatchPanelProps {
  initialText: string;
  onSubmit(titles: readonly string[]): BatchAddResult;
  onClose(): void;
}

export interface UndoNoticeProps {
  title: string;
  onUndo(): void;
  onDismiss(): void;
}

export interface TaskItemProps {
  task: Task;
  onToggle(id: Task['id']): void;
  onRemove(id: Task['id']): void;
  onUpdate?(id: Task['id'], title: string): AddTaskResult;
  onUpdateDetails?(id: Task['id'], details: TaskDetails): TaskDetailsResult;
}

export interface TaskListProps {
  tasks: readonly Task[];
  onToggle(id: Task['id']): void;
  onRemove(id: Task['id']): void;
  onUpdate?(id: Task['id'], title: string): AddTaskResult;
  onUpdateDetails?(id: Task['id'], details: TaskDetails): TaskDetailsResult;
}

export interface StorageNoticeProps {
  status: StorageStatus;
  replacementFailed?: boolean;
  onReplace(): void;
}
