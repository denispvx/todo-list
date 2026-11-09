import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { WorkspaceHeader } from '../src/app/WorkspaceHeader';

const day = new Date(2026, 10, 4, 12);

it('explains persistence on request without presenting it as account synchronization', async () => {
  const user = userEvent.setup();
  render(<WorkspaceHeader day={day} storageStatus="available" />);
  const trigger = screen.getByText('О данных');
  const details = trigger.closest('details')!;
  expect(details).not.toHaveAttribute('open');
  await user.click(trigger);
  expect(details).toHaveAttribute('open');
  expect(screen.getByText('Сохраняется в браузере')).toBeVisible();
  expect(screen.getByText(/На другом устройстве будет отдельный список/)).toBeVisible();
  await user.keyboard('{Escape}');
  expect(details).not.toHaveAttribute('open');
  expect(trigger).toHaveFocus();
});

it('closes with Escape even after selecting the explanatory text', async () => {
  const user = userEvent.setup();
  render(<WorkspaceHeader day={day} storageStatus="available" />);
  const trigger = screen.getByText('О данных');
  await user.click(trigger);
  fireEvent.blur(trigger, { relatedTarget: null });
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(trigger.closest('details')).not.toHaveAttribute('open');
  expect(trigger).toHaveFocus();
});

it('closes the explanation when interaction moves outside the header', async () => {
  const user = userEvent.setup();
  render(<><WorkspaceHeader day={day} storageStatus="available" /><button>Дальше</button></>);
  const trigger = screen.getByText('О данных');
  await user.click(trigger);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Дальше' })).toHaveFocus();
  expect(trigger.closest('details')).not.toHaveAttribute('open');
  await user.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(trigger.closest('details')).not.toHaveAttribute('open');
});

it('does not promise persistence when the browser reports a storage failure', async () => {
  const user = userEvent.setup();
  render(<WorkspaceHeader day={day} storageStatus="write-error" />);
  await user.click(screen.getByText('Не сохранено'));
  expect(screen.getByText('Изменения не сохранены')).toBeVisible();
  expect(screen.getByText(/могут исчезнуть после обновления/)).toBeVisible();
  expect(screen.queryByText('После обновления страницы задачи останутся в этом браузере.')).not.toBeInTheDocument();
});
