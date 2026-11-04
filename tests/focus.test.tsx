import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOCUS_DURATION_SECONDS, FOCUS_STORAGE_KEY, useFocusSession } from '../src/features/focus/useFocusSession';
import { STORAGE_KEY } from '../src/features/tasks/model';

const startedAt = new Date('2026-11-04T12:00:00Z').getTime();
const duration = 25 * 60 * 1000;
function seed(remainingMs: number, endsAt: number | null = null) {
  const raw = JSON.stringify({ version: 1, taskId: 'task-a', remainingMs, endsAt });
  window.localStorage.setItem(FOCUS_STORAGE_KEY, raw);
  return raw;
}
function saved() { return JSON.parse(window.localStorage.getItem(FOCUS_STORAGE_KEY)!); }
function mount() { return renderHook(() => useFocusSession(), { wrapper: StrictMode }); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(startedAt);
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('useFocusSession', () => {
  it('defaults to 25 minutes without selecting, starting or writing on mount', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const { result } = mount();

    expect(FOCUS_DURATION_SECONDS).toBe(1500);
    expect(result.current.taskId).toBeNull();
    expect(result.current.remainingSeconds).toBe(1500);
    expect(result.current.running).toBe(false);
    act(() => { result.current.start(); result.current.pause(); result.current.reset(); });
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('selects without autostart and persists a deadline only after start', () => {
    const { result } = mount();
    act(() => result.current.selectTask('task-a'));

    expect(result.current.running).toBe(false);
    expect(saved()).toEqual({ version: 1, taskId: 'task-a', remainingMs: duration, endsAt: null });
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
    expect(saved().endsAt).toBe(startedAt + duration);
  });

  it('uses wall-clock elapsed time when background ticks are delayed', () => {
    const { result } = mount();
    act(() => { result.current.selectTask('task-a'); result.current.start(); });

    act(() => { vi.setSystemTime(startedAt + 5 * 60 * 1000); vi.advanceTimersByTime(1000); });

    expect(result.current.remainingSeconds).toBe(1199);
    expect(result.current.running).toBe(true);
  });

  it('pauses at the precise deadline remainder and resumes after an idle pause', () => {
    const { result } = mount();
    act(() => { result.current.selectTask('task-a'); result.current.start(); });
    act(() => { vi.setSystemTime(startedAt + 12_345); result.current.pause(); });

    expect(result.current.remainingSeconds).toBe(1488);
    expect(result.current.running).toBe(false);
    expect(saved().remainingMs).toBe(duration - 12_345);
    expect(saved().endsAt).toBeNull();
    act(() => { vi.advanceTimersByTime(300_000); });
    expect(result.current.remainingSeconds).toBe(1488);
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.remainingSeconds).toBe(1478);
  });

  it('keeps the current task clock on reselect and resets only when switching tasks', () => {
    const { result } = mount();
    act(() => { result.current.selectTask('task-a'); result.current.start(); });
    act(() => { vi.advanceTimersByTime(10_000); });
    const deadline = saved().endsAt;

    act(() => result.current.selectTask('task-a'));
    expect(result.current.remainingSeconds).toBe(1490);
    expect(result.current.running).toBe(true);
    expect(saved().endsAt).toBe(deadline);
    act(() => result.current.selectTask('task-b'));
    expect(result.current.taskId).toBe('task-b');
    expect(result.current.remainingSeconds).toBe(1500);
    expect(result.current.running).toBe(false);
  });

  it('resets to a paused 25 minutes while retaining the selected task', () => {
    const { result } = mount();
    act(() => { result.current.selectTask('task-a'); result.current.start(); });
    act(() => { vi.advanceTimersByTime(30_000); result.current.reset(); });

    expect(result.current.taskId).toBe('task-a');
    expect(result.current.remainingSeconds).toBe(1500);
    expect(result.current.running).toBe(false);
    expect(saved().endsAt).toBeNull();
  });

  it('restores a running deadline after remount without rewriting it', () => {
    const { result, unmount } = mount();
    act(() => { result.current.selectTask('task-a'); result.current.start(); });
    const raw = window.localStorage.getItem(FOCUS_STORAGE_KEY);
    unmount();
    vi.setSystemTime(startedAt + 300_000);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const reloaded = mount();

    expect(reloaded.result.current.taskId).toBe('task-a');
    expect(reloaded.result.current.remainingSeconds).toBe(1200);
    expect(reloaded.result.current.running).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe(raw);
  });

  it('restores a paused remainder without autostart', () => {
    const raw = seed(90_000);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = mount();

    expect(result.current.remainingSeconds).toBe(90);
    expect(result.current.running).toBe(false);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.remainingSeconds).toBe(90);
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe(raw);
  });

  it('restores expired sessions as zero without completing tasks, then permits a new session', () => {
    const tasks = JSON.stringify({ version: 1, tasks: [{ id: 'task-a', title: 'Остаться незавершённой', completed: false }] });
    window.localStorage.setItem(STORAGE_KEY, tasks);
    seed(duration, startedAt - 1000);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = mount();

    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.running).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(tasks);
    act(() => result.current.start());
    expect(result.current.remainingSeconds).toBe(1500);
    expect(result.current.running).toBe(true);
    expect(saved().endsAt).toBe(startedAt + duration);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(tasks);
  });

  it.each([
    '{broken',
    JSON.stringify({ version: 2, taskId: 'task-a', remainingMs: duration, endsAt: null }),
    JSON.stringify({ version: 1, taskId: 'task-a', remainingMs: -1, endsAt: null }),
    JSON.stringify({ version: 1, taskId: 'task-a', remainingMs: duration, endsAt: startedAt + duration + 61_000 }),
  ])('safely ignores invalid timer data without overwriting it on mount', (raw) => {
    window.localStorage.setItem(FOCUS_STORAGE_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = mount();

    expect(result.current.taskId).toBeNull();
    expect(result.current.remainingSeconds).toBe(1500);
    expect(result.current.running).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe(raw);
  });

  it.each(['getter', 'getItem'] as const)('blocks writes and removals after a %s read failure until reload', (failure) => {
    const raw = seed(90_000);
    const read = failure === 'getter'
      ? vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); })
      : vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const { result } = mount();
    read.mockRestore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

    act(() => { result.current.selectTask('memory-only'); result.current.start(); });
    expect(result.current.running).toBe(true);
    expect(result.current.persistenceFailed).toBe(true);
    act(() => result.current.clear());
    expect(result.current.taskId).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe(raw);
  });

  it('keeps the timer usable in memory after save failure and clears the error on a successful action', () => {
    const { result } = mount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
    act(() => result.current.selectTask('task-a'));

    expect(result.current.taskId).toBe('task-a');
    expect(result.current.persistenceFailed).toBe(true);
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
    expect(result.current.persistenceFailed).toBe(false);
    expect(saved().taskId).toBe('task-a');
  });

  it('clears only the focus key and reports removal failure without retaining the session in memory', () => {
    window.localStorage.setItem(STORAGE_KEY, 'synthetic tasks value');
    window.localStorage.setItem('foreign:key', 'keep');
    seed(90_000);
    const { result } = mount();
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => { throw new DOMException('Denied', 'SecurityError'); });
    act(() => result.current.clear());

    expect(result.current.taskId).toBeNull();
    expect(result.current.running).toBe(false);
    expect(result.current.persistenceFailed).toBe(true);
    expect(removeItem).toHaveBeenCalledExactlyOnceWith(FOCUS_STORAGE_KEY);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('synthetic tasks value');
    expect(window.localStorage.getItem('foreign:key')).toBe('keep');
  });

  it('removes a saved focus session successfully without changing task data', () => {
    window.localStorage.setItem(STORAGE_KEY, 'keep task data');
    seed(90_000);
    const { result } = mount();
    act(() => result.current.clear());

    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBeNull();
    expect(result.current.persistenceFailed).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('keep task data');
  });
});
