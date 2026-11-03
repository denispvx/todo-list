import { expect, test } from '@playwright/test';

test('production build works from the project subpath', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./');
  await expect(page).toHaveTitle('Мои задачи — Список');
  await expect(page.getByRole('heading', { name: 'Мои задачи.' })).toBeVisible();
  await expect(page.getByText('Пока нет задач')).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Проверить каркас');
  await input.press('Enter');
  const checkbox = page.getByRole('checkbox', { name: 'Проверить каркас' });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: 'Удалить задачу «Проверить каркас»' }).click();
  await expect(page.getByText('Пока нет задач')).toBeVisible();
  expect(errors).toEqual([]);
});

test('narrow screen supports keyboard interaction without horizontal overflow', async ({ page }) => {
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
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
