import { expect, test, type Page } from '@playwright/test';

async function expectSavedTasks(page: Page) {
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(2);
  await expect(checkboxes.nth(0)).toHaveAccessibleName('C');
  await expect(checkboxes.nth(0)).not.toBeChecked();
  await expect(checkboxes.nth(1)).toHaveAccessibleName('B');
  await expect(checkboxes.nth(1)).toBeChecked();
  await expect(page.getByRole('button', { name: 'Удалить задачу «A»' })).toHaveCount(0);
}

test('production subpath preserves task order, completion and deletion across reloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./');
  await expect(page).toHaveTitle('Мои задачи — Список');
  await expect(page.getByRole('heading', { name: 'Мои задачи.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пока нет задач' })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Новая задача' });

  for (const title of ['A', 'B', 'C']) {
    await input.fill(title);
    await page.getByRole('button', { name: 'Добавить' }).click();
  }
  await page.getByRole('checkbox', { name: 'B', exact: true }).check();
  await page.getByRole('button', { name: 'Удалить задачу «A»' }).click();
  await expectSavedTasks(page);

  for (let reload = 0; reload < 2; reload += 1) {
    await page.reload();
    await expectSavedTasks(page);
  }

  await page.getByRole('button', { name: 'Удалить задачу «C»' }).click();
  await page.getByRole('button', { name: 'Удалить задачу «B»' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Пока нет задач' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('320px layout supports keyboard interaction and persistence without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('./');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.focus();
  await page.keyboard.type('Keyboard task');
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await page.keyboard.press('Tab');
  const checkbox = page.getByRole('checkbox', { name: 'Keyboard task' });
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(checkbox).toBeChecked();
  await input.focus();
  await page.keyboard.press('Tab');
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Удалить задачу «Keyboard task»' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Пока нет задач' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Пока нет задач' })).toBeVisible();
});
