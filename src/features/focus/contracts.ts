import type { Task } from '../tasks/model';

export interface FocusSessionController {
  taskId: string | null;
  remainingSeconds: number;
  running: boolean;
  persistenceFailed: boolean;
  selectTask(id: string): void;
  start(): void;
  pause(): void;
  reset(): void;
  clear(): void;
}

export interface FocusPanelProps {
  open: boolean;
  task: Task | null;
  remainingSeconds: number;
  running: boolean;
  finished: boolean;
  persistenceFailed: boolean;
  canSwitch: boolean;
  onStart(): void;
  onPause(): void;
  onReset(): void;
  onComplete(): void;
  onNext(): void;
  onClose(): void;
}
