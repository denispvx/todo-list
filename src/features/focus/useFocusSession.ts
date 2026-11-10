import { useEffect, useRef, useState } from 'react';
import type { FocusSessionController } from './contracts';

export const FOCUS_STORAGE_KEY = 'todo-list:focus:v1';
export const FOCUS_DURATION_SECONDS = 25 * 60;
const DURATION_MS = FOCUS_DURATION_SECONDS * 1000;

type Session = Readonly<{
  version: 1;
  taskId: string | null;
  remainingMs: number;
  endsAt: number | null;
}>;

type State = Readonly<{
  session: Session;
  readBlocked: boolean;
  persistenceFailed: boolean;
  snapshot: string | null;
}>;

function emptySession(): Session {
  return { version: 1, taskId: null, remainingMs: DURATION_MS, endsAt: null };
}

function readSession(): State {
  const fallback: State = { session: emptySession(), readBlocked: false, persistenceFailed: false, snapshot: null };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(FOCUS_STORAGE_KEY);
  } catch {
    return { ...fallback, readBlocked: true, persistenceFailed: true };
  }
  if (raw === null) return fallback;
  const stored = { ...fallback, snapshot: raw };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return stored;
    const data = value as Record<string, unknown>;
    if (data.version !== 1
      || typeof data.taskId !== 'string' || data.taskId.trim().length === 0
      || typeof data.remainingMs !== 'number' || !Number.isFinite(data.remainingMs)
      || data.remainingMs < 0 || data.remainingMs > DURATION_MS
      || !(data.endsAt === null || (typeof data.endsAt === 'number' && Number.isFinite(data.endsAt)
        && data.endsAt > 0 && data.endsAt <= Date.now() + DURATION_MS + 60_000))) return stored;
    return {
      ...stored,
      session: { version: 1, taskId: data.taskId, remainingMs: data.remainingMs, endsAt: data.endsAt },
    };
  } catch {
    return stored;
  }
}

function remaining(session: Session, now: number): number {
  const duration = session.endsAt === null ? session.remainingMs : session.endsAt - now;
  return Math.min(DURATION_MS, Math.max(0, duration));
}

function secondsLeft(session: Session, now: number): number {
  return Math.ceil(remaining(session, now) / 1000);
}

export function useFocusSession(): FocusSessionController {
  const [state, setState] = useState(readSession);
  const latest = useRef(state);
  const [now, setNow] = useState(() => Date.now());
  const { session } = state;
  const remainingSeconds = secondsLeft(session, now);
  const running = state.session.taskId !== null && state.session.endsAt !== null && remainingSeconds > 0;

  useEffect(() => {
    if (!running) return;
    // Wall-clock deadlines stay accurate when background tabs throttle the interval.
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow((previous) => secondsLeft(session, previous) === secondsLeft(session, time) ? previous : time);
    }, 250);
    return () => window.clearInterval(interval);
  }, [running, session]);

  function publish(session: Session) {
    const current = latest.current;
    let persistenceFailed = current.readBlocked;
    let snapshot = current.snapshot;
    if (!current.readBlocked) {
      try {
        const storage = window.localStorage;
        if (storage.getItem(FOCUS_STORAGE_KEY) !== snapshot) {
          persistenceFailed = true;
        } else {
          const serialized = session.taskId === null ? null : JSON.stringify(session);
          if (serialized === null) storage.removeItem(FOCUS_STORAGE_KEY);
          else storage.setItem(FOCUS_STORAGE_KEY, serialized);
          snapshot = serialized;
        }
      } catch {
        persistenceFailed = true;
      }
    }
    const next = { session, readBlocked: current.readBlocked, persistenceFailed, snapshot };
    latest.current = next;
    setState(next);
    setNow(Date.now());
  }

  function selectTask(id: string) {
    if (!id.trim() || latest.current.session.taskId === id) return;
    publish({ ...emptySession(), taskId: id });
  }

  function start() {
    const session = latest.current.session;
    const time = Date.now();
    if (session.taskId === null || (session.endsAt !== null && session.endsAt > time)) return;
    const duration = remaining(session, time) || DURATION_MS;
    publish({ ...session, remainingMs: duration, endsAt: time + duration });
  }

  function pause() {
    const session = latest.current.session;
    if (session.taskId === null || session.endsAt === null) return;
    publish({ ...session, remainingMs: remaining(session, Date.now()), endsAt: null });
  }

  function reset() {
    const session = latest.current.session;
    if (session.taskId === null) return;
    publish({ ...session, remainingMs: DURATION_MS, endsAt: null });
  }

  function clear() {
    if (latest.current.session.taskId === null) return;
    publish(emptySession());
  }

  return {
    taskId: state.session.taskId, remainingSeconds, running,
    persistenceFailed: state.persistenceFailed,
    selectTask, start, pause, reset, clear,
  };
}
