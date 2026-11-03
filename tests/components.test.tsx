import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskForm } from '../src/features/tasks/components/TaskForm';
import { TaskList } from '../src/features/tasks/components/TaskList';
import { MAX_TASK_TITLE_LENGTH, type AddTaskResult, type Task } from '../src/features/tasks/model';

describe('TaskForm', () => {
  it.each(['button', 'Enter'] as const)('adds a task through %s and keeps focus in the field', async (method) => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => AddTaskResult>().mockReturnValue({ ok: true });
    render(<TaskForm onAdd={onAdd} />);

    const input = screen.getByRole('textbox', { name: 'Новая задача' });
    await user.type(input, 'Проверить готовую версию');

    if (method === 'button') {
      await user.click(screen.getByRole('button', { name: 'Добавить' }));
    } else {
      await user.keyboard('{Enter}');
    }

    expect(onAdd).toHaveBeenCalledExactlyOnceWith('Проверить готовую версию');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('passes the raw draft to onAdd so the handler owns normalization', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => AddTaskResult>().mockReturnValue({ ok: true });
    render(<TaskForm onAdd={onAdd} />);

    await user.type(screen.getByRole('textbox', { name: 'Новая задача' }), '  задача  ');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(onAdd).toHaveBeenCalledExactlyOnceWith('  задача  ');
  });

  it('does not submit an empty or whitespace-only draft', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => AddTaskResult>().mockReturnValue({ ok: true });
    render(<TaskForm onAdd={onAdd} />);

    const input = screen.getByRole('textbox', { name: 'Новая задача' });
    const button = screen.getByRole('button', { name: 'Добавить' });
    expect(button).toBeDisabled();

    await user.type(input, '   ');
    await user.keyboard('{Enter}');
    await user.click(button);

    expect(button).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('preserves a draft and exposes an error when onAdd rejects the submission', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => AddTaskResult>().mockReturnValue({
      ok: false,
      error: 'too-long',
    });
    render(<TaskForm onAdd={onAdd} />);

    const input = screen.getByRole('textbox', { name: 'Новая задача' });
    await user.type(input, 'Сохранить мой черновик');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(onAdd).toHaveBeenCalledExactlyOnceWith('Сохранить мой черновик');
    expect(input).toHaveValue('Сохранить мой черновик');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
  });

  it('applies the shared title length limit to the input', () => {
    render(<TaskForm onAdd={() => ({ ok: true })} />);

    expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveAttribute(
      'maxlength',
      String(MAX_TASK_TITLE_LENGTH),
    );
  });
});

describe('TaskList', () => {
  it('shows an empty state without fabricated tasks', () => {
    render(<TaskList tasks={[]} onToggle={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Пока нет задач' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Удалить/ })).not.toBeInTheDocument();
  });

  it('renders completion and addresses duplicate titles by their IDs', async () => {
    const user = userEvent.setup();
    const tasks: readonly Task[] = [
      { id: 'first', title: 'Проверить отчёт', completed: false },
      { id: 'second', title: 'Проверить отчёт', completed: true },
    ];
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    render(<TaskList tasks={tasks} onToggle={onToggle} onRemove={onRemove} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!);
    const second = within(rows[1]!);
    expect(first.getByRole('checkbox', { name: 'Проверить отчёт' })).not.toBeChecked();
    expect(second.getByRole('checkbox', { name: 'Проверить отчёт' })).toBeChecked();

    await user.click(second.getByRole('checkbox', { name: 'Проверить отчёт' }));
    await user.click(first.getByRole('button', { name: /Удалить.*Проверить отчёт/ }));

    expect(onToggle).toHaveBeenCalledExactlyOnceWith('second');
    expect(onRemove).toHaveBeenCalledExactlyOnceWith('first');
  });

  it('displays markup in a title as plain text', () => {
    const title = '<img src=x onerror=alert(1)>';
    render(
      <TaskList
        tasks={[{ id: 'markup', title, completed: false }]}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
