import { expect, test, type Page } from '@playwright/test';
import { MAX_BATCH_DRAFT_LENGTH } from '../src/features/tasks/batch';

async function add(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'Новая задача' }).fill(title);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
}

test('a stale tab keeps its draft in memory and preserves the newer saved list', async ({ page, context }) => {
  await page.goto('./');
  const stale = await context.newPage();
  await stale.goto('./');
  await add(page, 'Сохранено в первой вкладке');
  await add(stale, 'Локальный черновик');
  await expect(stale.getByRole('checkbox', { name: 'Локальный черновик' })).toBeVisible();
  await expect(stale.getByText(/Сохранённый список изменился/)).toBeVisible();
  await stale.reload();
  await expect(stale.getByRole('checkbox', { name: 'Сохранено в первой вкладке' })).toBeVisible();
  await expect(stale.getByRole('checkbox', { name: 'Локальный черновик' })).toHaveCount(0);
});

test('production policy blocks inline scripts and network connections while task text stays literal', async ({ page }) => {
  await page.goto('./');
  const title = '<img src=x onerror="document.body.dataset.injected=1">';
  await add(page, title);
  await expect(page.getByRole('checkbox', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('.task-title img')).toHaveCount(0);
  const violations = await page.evaluate(async () => {
    const directives: string[] = [];
    document.addEventListener('securitypolicyviolation', (event) => directives.push(event.effectiveDirective));
    const script = document.createElement('script');
    script.textContent = 'document.body.dataset.injected = "1"';
    document.body.append(script);
    await fetch(location.href).catch(() => undefined);
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    return { directives, injected: document.body.dataset.injected };
  });
  expect(violations.injected).toBeUndefined();
  expect(violations.directives).toEqual(expect.arrayContaining(['script-src-elem', 'connect-src']));
});

test('an oversized paste opens an empty, recoverable batch form without writing tasks', async ({ page }) => {
  await page.goto('./');
  const composer = page.getByRole('textbox', { name: 'Новая задача' });
  await composer.evaluate((input, limit) => {
    const data = new DataTransfer();
    data.setData('text/plain', `Задача\n${' '.repeat(limit)}`);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, MAX_BATCH_DRAFT_LENGTH);
  const draft = page.getByRole('textbox', { name: 'Список задач' });
  await expect(draft).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveText(/Вставленный текст слишком большой/);
  await expect(page.getByRole('button', { name: 'Добавить задачи' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('todo-list:tasks:v1'))).toBeNull();
  await draft.fill('Первая\nВторая');
  await page.getByRole('button', { name: 'Добавить задачи' }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
});

test('completing the middle task in focus advances to the following task', async ({ page }) => {
  await page.goto('./');
  await add(page, 'Последняя');
  await add(page, 'Средняя');
  await add(page, 'Первая');
  await page.getByRole('button', { name: 'Режим фокуса', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Режим фокуса' });
  await dialog.getByRole('button', { name: 'Следующая' }).click();
  await expect(dialog.getByRole('heading', { name: 'Средняя' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Готово' }).click();
  await expect(dialog.getByRole('heading', { name: 'Последняя' })).toBeVisible();
});

test('an out-of-range date cannot disappear when planning collapses and can be cleared', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('textbox', { name: 'Новая задача' }).fill('Задача со сроком');
  const planning = page.getByRole('button', { name: 'Срок и приоритет' });
  await planning.click();
  const date = page.getByLabel('Срок', { exact: true });
  await date.fill('10000-01-01');
  expect(await date.evaluate((element: HTMLInputElement) => element.validity.rangeOverflow)).toBe(true);
  await planning.click();
  await expect(date).toBeFocused();
  await expect(page.getByRole('alert')).toHaveText('Укажите существующую дату.');
  await page.getByRole('button', { name: 'Убрать срок' }).click();
  await expect(date).toHaveValue('');
  await planning.click();
  await expect(date).toHaveCount(0);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Задача со сроком' })).toBeVisible();
});

test('show all from an empty filter returns keyboard focus to the composer', async ({ page }) => {
  await page.goto('./');
  await add(page, 'В работе');
  await page.getByRole('button', { name: 'Готовые', exact: true }).click();
  await page.getByRole('button', { name: 'Показать все' }).press('Enter');
  await expect(page.getByRole('checkbox', { name: 'В работе' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Новая задача' })).toBeFocused();
});
