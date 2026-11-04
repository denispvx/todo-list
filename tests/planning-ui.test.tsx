import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TaskForm } from '../src/features/tasks/components/TaskForm';
import { TaskItem } from '../src/features/tasks/components/TaskItem';
import type { AddTaskResult, TaskDetails, TaskDetailsResult } from '../src/features/tasks/model';

it('keeps importance, urgency and date visible in a collapsed draft and submits them atomically', async () => {
  const user = userEvent.setup();
  const onAdd = vi.fn<(title: string) => AddTaskResult>().mockReturnValue({ ok: true });
  const onAddPlanned = vi.fn<(details: TaskDetails) => TaskDetailsResult>().mockReturnValue({ ok: true });
  render(<TaskForm onAdd={onAdd} onAddPlanned={onAddPlanned} />);
  await user.type(screen.getByRole('textbox', { name: 'Новая задача' }), 'Спланировать релиз');
  const toggle = screen.getByRole('button', { name: 'Срок и приоритет' });
  await user.click(toggle);
  await user.click(screen.getByRole('checkbox', { name: 'Важно' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Срочность' }), 'later');
  fireEvent.change(screen.getByLabelText('Срок'), { target: { value: '2026-11-06' } });
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveAccessibleDescription(/Важно · Не срочно/);
  expect(screen.queryByLabelText('Срок')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Добавить' }));
  expect(onAddPlanned).toHaveBeenCalledExactlyOnceWith({ title: 'Спланировать релиз', important: true, urgency: 'later', dueDate: '2026-11-06' });
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveValue('');
  expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveFocus();
  expect(toggle).not.toHaveAccessibleDescription();
});

it('describes planning without changing the task checkbox name or using overdue styling for completed tasks', () => {
  const { rerender } = render(<ul><TaskItem task={{ id: 'a', title: 'Проверить договор', completed: false,
    important: true, urgency: 'urgent', dueDate: '2000-01-01' }} onToggle={vi.fn()} onRemove={vi.fn()} /></ul>);
  const checkbox = screen.getByRole('checkbox', { name: 'Проверить договор' });
  expect(checkbox).toHaveAccessibleName('Проверить договор');
  expect(checkbox).toHaveAccessibleDescription(/Важно.*Срочно.*Просрочено/);
  expect(screen.getByText(/Просрочено/)).toHaveClass('task-meta-overdue');
  rerender(<ul><TaskItem task={{ id: 'a', title: 'Проверить договор', completed: true,
    important: true, urgency: 'urgent', dueDate: '2000-01-01' }} onToggle={vi.fn()} onRemove={vi.fn()} /></ul>);
  expect(screen.queryByText(/Просрочено/)).not.toBeInTheDocument();
  expect(screen.getByText('Срочно')).not.toHaveClass('task-meta-urgent');
});

it('edits all details together, supports clearing the date and returns focus without toggling the task', async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const onUpdate = vi.fn<(id: string, title: string) => AddTaskResult>().mockReturnValue({ ok: true });
  const onUpdateDetails = vi.fn<(id: string, details: TaskDetails) => TaskDetailsResult>().mockReturnValue({ ok: true });
  render(<ul><TaskItem task={{ id: 'a', title: 'Важная задача', completed: false, important: true, dueDate: '2026-11-06' }}
    onToggle={onToggle} onRemove={vi.fn()} onUpdate={onUpdate} onUpdateDetails={onUpdateDetails} /></ul>);
  await user.click(screen.getByRole('button', { name: 'Изменить задачу «Важная задача»' }));
  expect(screen.getByRole('checkbox', { name: 'Важно' })).toBeChecked();
  expect(screen.getByRole('combobox', { name: 'Срочность' })).toHaveValue('none');
  await user.clear(screen.getByRole('textbox', { name: 'Название задачи' }));
  await user.type(screen.getByRole('textbox', { name: 'Название задачи' }), 'Срочная задача');
  await user.click(screen.getByRole('checkbox', { name: 'Важно' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Срочность' }), 'urgent');
  await user.click(screen.getByRole('button', { name: 'Убрать срок' }));
  expect(screen.getByLabelText('Срок')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(onUpdateDetails).toHaveBeenCalledExactlyOnceWith('a', { title: 'Срочная задача', important: false, urgency: 'urgent', dueDate: '' });
  expect(onUpdate).not.toHaveBeenCalled();
  expect(onToggle).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Изменить задачу «Важная задача»' })).toHaveFocus();
});

it('keeps a rejected planned draft and focuses its date error', async () => {
  const user = userEvent.setup();
  const onAddPlanned = vi.fn<(details: TaskDetails) => TaskDetailsResult>().mockReturnValue({ ok: false, error: 'invalid-date' });
  render(<TaskForm onAdd={vi.fn().mockReturnValue({ ok: true })} onAddPlanned={onAddPlanned} />);
  await user.type(screen.getByRole('textbox', { name: 'Новая задача' }), 'Задача с датой');
  await user.click(screen.getByRole('button', { name: 'Срок и приоритет' }));
  fireEvent.change(screen.getByLabelText('Срок'), { target: { value: '2026-11-06' } });
  await user.click(screen.getByRole('button', { name: 'Добавить' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Укажите существующую дату.');
  expect(screen.getByLabelText('Срок')).toHaveFocus();
  expect(screen.getByLabelText('Срок')).toHaveValue('2026-11-06');
  expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveValue('Задача с датой');
});

it('discards changed planning on Escape and reopens the saved values', async () => {
  const user = userEvent.setup();
  const onUpdateDetails = vi.fn<(id: string, details: TaskDetails) => TaskDetailsResult>().mockReturnValue({ ok: true });
  render(<ul><TaskItem task={{ id: 'a', title: 'План', completed: false, important: true, urgency: 'later', dueDate: '2026-11-06' }}
    onToggle={vi.fn()} onRemove={vi.fn()} onUpdateDetails={onUpdateDetails} /></ul>);
  const open = () => user.click(screen.getByRole('button', { name: 'Изменить задачу «План»' }));
  await open();
  await user.click(screen.getByRole('checkbox', { name: 'Важно' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Срочность' }), 'urgent');
  await user.click(screen.getByRole('button', { name: 'Убрать срок' }));
  await user.keyboard('{Escape}');
  expect(onUpdateDetails).not.toHaveBeenCalled();
  await open();
  expect(screen.getByRole('checkbox', { name: 'Важно' })).toBeChecked();
  expect(screen.getByRole('combobox', { name: 'Срочность' })).toHaveValue('later');
  expect(screen.getByLabelText('Срок')).toHaveValue('2026-11-06');
});
