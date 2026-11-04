import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/app/App';
import { STORAGE_KEY, STORAGE_VERSION } from '../src/features/tasks/model';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('App storage integration', () => {
  it('replaces invalid storage only through the recovery action and removes the notice after success', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, '{broken');
    render(<StrictMode><App /></StrictMode>);

    const warning = 'Не удалось восстановить сохранённый список. Новые задачи пока не сохраняются.';
    expect(screen.getByText(warning)).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Новая задача' }), 'Новая задача после ошибки');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(screen.getByRole('checkbox', { name: 'Новая задача после ошибки' })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{broken');
    expect(screen.getByText(warning)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Сохранить текущий список' }));

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      version: STORAGE_VERSION,
      tasks: [{ id: expect.any(String), title: 'Новая задача после ошибки', completed: false }],
    });
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить текущий список' })).not.toBeInTheDocument();
    expect(screen.getByText('На устройстве')).toBeVisible();
    expect(screen.getByText('На устройстве')).toHaveAttribute('title', 'Задачи сохраняются в этом браузере');
    expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveFocus();
  });

  it('keeps a task visible and announces a failure when saving is unavailable', async () => {
    const user = userEvent.setup();
    const original = JSON.stringify({ version: STORAGE_VERSION, tasks: [] });
    window.localStorage.setItem(STORAGE_KEY, original);
    render(<StrictMode><App /></StrictMode>);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });

    await user.type(screen.getByRole('textbox', { name: 'Новая задача' }), 'Остаться в памяти');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(screen.getByRole('checkbox', { name: 'Остаться в памяти' })).toBeInTheDocument();
    const warning = screen.getByText('Изменения не удалось сохранить. После обновления страницы они могут исчезнуть.');
    expect(warning).toBeVisible();
    expect(warning.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(original);
    expect(screen.getByText('Не сохранено')).toBeVisible();
    expect(screen.getByText('Не сохранено')).toHaveAttribute('title', 'Изменения пока не сохранены');
  });
});
