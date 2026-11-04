import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskItem } from '../src/features/tasks/components/TaskItem';
import { STORAGE_KEY, type AddTaskResult, type Task } from '../src/features/tasks/model';
import { useTasks } from '../src/features/tasks/useTasks';

const tasks: readonly Task[] = [
  { id: 'a', title: 'Одинаковое название', completed: true },
  { id: 'b', title: 'Одинаковое название', completed: false },
];

beforeEach(() => window.localStorage.clear());

describe('task editing', () => {
  it('renames only the addressed task, preserves order and status, and restores the change', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
    const { result, unmount } = renderHook(useTasks, { wrapper: StrictMode });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => expect(result.current.updateTask('a', '  Новое  название  ')).toEqual({ ok: true }));
    expect(result.current.tasks).toEqual([{ ...tasks[0], title: 'Новое  название' }, tasks[1]]);
    expect(write).toHaveBeenCalledTimes(1);
    unmount();
    const reloaded = renderHook(useTasks, { wrapper: StrictMode });
    expect(reloaded.result.current.tasks).toEqual([{ ...tasks[0], title: 'Новое  название' }, tasks[1]]);
  });

  it('rejects invalid drafts and avoids writes for unchanged titles and unknown IDs', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
    const { result } = renderHook(useTasks, { wrapper: StrictMode });
    const before = result.current.tasks;
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => {
      expect(result.current.updateTask('a', '  ')).toEqual({ ok: false, error: 'empty' });
      expect(result.current.updateTask('a', 'я'.repeat(201))).toEqual({ ok: false, error: 'too-long' });
      expect(result.current.updateTask('a', ` ${tasks[0]!.title} `)).toEqual({ ok: true });
      expect(result.current.updateTask('missing', 'Название')).toEqual({ ok: true });
    });
    expect(result.current.tasks).toBe(before);
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps a rename in memory on write failure and preserves deletion undo history', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
    const { result } = renderHook(useTasks, { wrapper: StrictMode });
    act(() => result.current.removeTask('b'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
    act(() => result.current.updateTask('a', 'Изменение'));
    expect(result.current.storageStatus).toBe('write-error');
    expect(result.current.tasks[0]?.title).toBe('Изменение');
    expect(result.current.lastRemovedTask).toEqual(tasks[1]);
    act(() => result.current.undoRemoval());
    expect(result.current.storageStatus).toBe('available');
    expect(result.current.tasks).toEqual([{ ...tasks[0], title: 'Изменение' }, tasks[1]]);
  });

  it('selects the current title, saves with Enter and returns focus without toggling or deleting', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    const onUpdate = vi.fn<(id: string, title: string) => AddTaskResult>().mockReturnValue({ ok: true });
    render(<ul><TaskItem task={tasks[0]!} onToggle={onToggle} onRemove={onRemove} onUpdate={onUpdate} /></ul>);
    const edit = screen.getByRole('button', { name: /Изменить задачу/ });
    await user.click(edit);
    const field = screen.getByRole('textbox', { name: 'Название задачи' });
    expect(field).toHaveFocus();
    expect((field as HTMLTextAreaElement).selectionStart).toBe(0);
    expect((field as HTMLTextAreaElement).selectionEnd).toBe(tasks[0]!.title.length);
    expect(field).toHaveAttribute('maxlength', '200');
    await user.clear(field);
    await user.type(field, 'Новая версия{Enter}');
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('a', 'Новая версия');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Изменить задачу/ })).toHaveFocus();
    expect(onToggle).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it.each(['Escape', 'button'] as const)('cancels through %s and keeps the original title', async (method) => {
    const user = userEvent.setup();
    const onUpdate = vi.fn<(id: string, title: string) => AddTaskResult>();
    render(<ul><TaskItem task={tasks[0]!} onToggle={vi.fn()} onRemove={vi.fn()} onUpdate={onUpdate} /></ul>);
    await user.click(screen.getByRole('button', { name: /Изменить задачу/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Название задачи' }));
    if (method === 'Escape') await user.keyboard('{Escape}');
    else await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: tasks[0]!.title })).toBeChecked();
    expect(screen.getByRole('button', { name: /Изменить задачу/ })).toHaveFocus();
  });

  it('keeps the draft and returns focus to the field after a rejected save', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn<(id: string, title: string) => AddTaskResult>().mockReturnValue({ ok: false, error: 'empty' });
    render(<ul><TaskItem task={tasks[0]!} onToggle={vi.fn()} onRemove={vi.fn()} onUpdate={onUpdate} /></ul>);
    await user.click(screen.getByRole('button', { name: /Изменить задачу/ }));
    const field = screen.getByRole('textbox', { name: 'Название задачи' });
    fireEvent.change(field, { target: { value: '   ' } });
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(field).toHaveValue('   ');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Введите название задачи.');
  });
});
