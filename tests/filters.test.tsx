import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/app/App';
import { STORAGE_KEY } from '../src/features/tasks/model';

beforeEach(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: [
    { id: 'active', title: 'Незавершённая', completed: false },
    { id: 'done', title: 'Выполненная', completed: true },
  ] }));
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it('filters the view without changing saved tasks or the overall progress', async () => {
  const user = userEvent.setup();
  render(<App />);
  const saved = localStorage.getItem(STORAGE_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await user.click(screen.getByRole('button', { name: 'В работе' }));
  expect(screen.getByRole('checkbox', { name: 'Незавершённая' })).toBeVisible();
  expect(screen.queryByRole('checkbox', { name: 'Выполненная' })).not.toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2');
  await user.click(screen.getByRole('button', { name: 'Готовые' }));
  expect(screen.getByRole('checkbox', { name: 'Выполненная' })).toBeChecked();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  expect(write).not.toHaveBeenCalled();
});

it('keeps focus usable when completion removes the last task in the current view', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'В работе' }));
  await user.click(screen.getByRole('checkbox', { name: 'Незавершённая' }));
  expect(screen.getByText('Всё сделано.')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveFocus();
  expect(screen.queryByText('Пока нет задач')).not.toBeInTheDocument();
});

it('reveals restored and newly added tasks when a filter would hide them', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Удалить задачу «Выполненная»' }));
  await user.click(screen.getByRole('button', { name: 'В работе' }));
  await user.click(within(screen.getByRole('complementary', { name: 'Отмена удаления' })).getByRole('button', { name: 'Вернуть' }));
  expect(screen.getByRole('button', { name: 'Все' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('checkbox', { name: 'Выполненная' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Готовые' }));
  await user.type(screen.getByRole('textbox', { name: 'Новая задача' }), 'Новая{Enter}');
  expect(screen.getByRole('button', { name: 'Все' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('checkbox', { name: 'Новая' })).toBeVisible();
});

it('returns focus to the composer when deleting the last task in a filtered view', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Готовые' }));
  await user.click(screen.getByRole('button', { name: 'Удалить задачу «Выполненная»' }));
  expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveFocus();
  expect(screen.getByText('Здесь будут выполненные задачи.')).toBeVisible();
});

it('supports the undo shortcut with the Russian keyboard layout outside a text field', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Удалить задачу «Выполненная»' }));
  const filter = screen.getByRole('button', { name: 'Все' });
  filter.focus();
  fireEvent.keyDown(filter, { key: 'я', code: 'KeyZ', ctrlKey: true });
  expect(screen.getByRole('checkbox', { name: 'Выполненная' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Выполненная' })).toHaveFocus();
});
