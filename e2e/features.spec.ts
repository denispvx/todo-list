import { expect, test, type Page } from '@playwright/test';

const tasksKey = 'todo-list:tasks:v1';
const focusKey = 'todo-list:focus:v1';
async function add(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'Новая задача' }).fill(title);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
}
async function savedTasks(page: Page): Promise<Array<{ id: string; title: string; completed: boolean }>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).tasks, tasksKey);
}

test('multiline paste previews an atomic ordered batch and rejects invalid drafts', async ({ page }) => {
  await page.addInitScript((key) => {
    const setItem = Storage.prototype.setItem;
    Object.defineProperty(window, 'batchWriteCount', { value: { count: 0 } });
    Storage.prototype.setItem = function (itemKey, value) {
      if (itemKey === key) (window as unknown as { batchWriteCount: { count: number } }).batchWriteCount.count += 1;
      return setItem.call(this, itemKey, value);
    };
  }, tasksKey);
  await page.goto('./');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  const draft = '- [ ] Первая 📝\n- [x] Вторая\n3. Третья';
  const prevented = await input.evaluate((element, text) => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', text);
    return !element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
  }, draft);

  expect(prevented).toBe(true);
  await expect(page.getByRole('heading', { name: 'Добавить списком' })).toBeVisible();
  const textarea = page.getByRole('textbox', { name: 'Список задач', exact: true });
  await expect(textarea).toHaveValue(draft);
  await expect(input).toHaveValue('');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Добавить задачи', exact: true }).click();

  await expect(textarea).toHaveCount(0);
  await expect(input).toBeFocused();
  const tasks = await savedTasks(page);
  expect(tasks.map((task) => task.title)).toEqual(['Первая 📝', 'Вторая', 'Третья']);
  expect(tasks.map((task) => task.completed)).toEqual([false, false, false]);
  expect(new Set(tasks.map((task) => task.id)).size).toBe(3);
  expect(await page.evaluate(() => (window as unknown as { batchWriteCount: { count: number } }).batchWriteCount.count)).toBe(1);
  await page.reload();
  await expect(page.getByRole('checkbox').nth(0)).toHaveAccessibleName('Первая 📝');
  await expect(page.getByRole('checkbox').nth(2)).toHaveAccessibleName('Третья');

  await page.getByRole('button', { name: 'Списком', exact: true }).click();
  await textarea.fill(`Допустимая\n${'я'.repeat(201)}`);
  await expect(page.getByRole('button', { name: 'Добавить задачи', exact: true })).toBeDisabled();
  await textarea.fill(Array.from({ length: 51 }, (_, index) => `Задача ${index}`).join('\n'));
  await expect(page.getByRole('button', { name: 'Добавить задачи', exact: true })).toBeDisabled();
  await textarea.press('Escape');
  await expect(textarea).toHaveCount(0);
  await expect(input).toBeFocused();
  expect(await savedTasks(page)).toEqual(tasks);
});

test('undo restores the same completed task and leaves native text undo available', async ({ page }) => {
  await page.goto('./');
  for (const title of ['A', 'B', 'C']) await add(page, title);
  await page.getByRole('checkbox', { name: 'B', exact: true }).check();
  const before = await savedTasks(page);
  await page.getByRole('button', { name: 'Удалить задачу «B»' }).click();
  await expect(page.getByText('Задача удалена', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Вернуть', exact: true }).click();

  expect(await savedTasks(page)).toEqual(before);
  await expect(page.getByRole('checkbox', { name: 'B', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'B', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Удалить задачу «C»' }).click();
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.focus();
  await input.pressSequentially('Черновик');
  await input.press('Control+z');
  await expect(input).not.toHaveValue('Черновик');
  await expect(page.getByRole('checkbox', { name: 'C', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Вернуть', exact: true })).toBeVisible();

  await page.getByRole('checkbox', { name: 'B', exact: true }).focus();
  await page.keyboard.press('Control+z');
  expect(await savedTasks(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Вернуть', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'C', exact: true })).toBeFocused();
});

test('focus uses a native modal, keeps background controls inert and preserves the clock when closed', async ({ page }) => {
  await page.goto('./');
  await add(page, 'Первая');
  await add(page, 'Вторая');
  const entry = page.getByRole('button', { name: 'Режим фокуса', exact: true });
  await entry.click();
  const dialog = page.getByRole('dialog', { name: 'Режим фокуса', exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
  await expect(dialog.getByRole('timer')).toHaveText('25:00');
  await expect(dialog.getByRole('button', { name: 'Начать', exact: true })).toBeEnabled();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).endsAt, focusKey)).toBeNull();
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 9; index += 1) {
      await page.keyboard.press(key);
      // Native dialog permits browser-chrome focus between its last and first control.
      expect(await dialog.evaluate((element) => element.contains(document.activeElement)
        || document.activeElement === document.body)).toBe(true);
    }
  }
  expect(await page.getByRole('textbox', { name: 'Новая задача', includeHidden: true }).evaluate((element) => {
    element.focus();
    return document.activeElement === element;
  })).toBe(false);
  await dialog.getByRole('button', { name: 'Начать', exact: true }).click();
  const deadline = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).endsAt, focusKey);
  expect(deadline).toBeGreaterThan(Date.now());
  await dialog.getByRole('button', { name: 'Закрыть режим фокуса', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(entry).toBeFocused();
  await entry.click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).endsAt, focusKey)).toBe(deadline);
  await dialog.getByRole('button', { name: 'Пауза', exact: true }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).endsAt, focusKey)).toBeNull();
  await dialog.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(dialog.getByRole('timer')).toHaveText('25:00');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(entry).toBeFocused();

  await page.getByRole('button', { name: 'Списком', exact: true }).click();
  const textarea = page.getByRole('textbox', { name: 'Список задач', exact: true });
  await textarea.fill('Черновик пакета');
  await entry.click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(textarea).toHaveValue('Черновик пакета');
  await textarea.press('Escape');
  await expect(textarea).toHaveCount(0);
  await entry.click();
  await dialog.getByRole('button', { name: 'Готово', exact: true }).click();
  await dialog.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Все задачи выполнены', exact: true })).toBeVisible();
  expect((await savedTasks(page)).every((task) => task.completed)).toBe(true);
  await dialog.getByRole('button', { name: 'Вернуться к списку', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Новая задача' })).toBeFocused();
});

test('an expired focus deadline shows completion of the session without completing the task', async ({ page }) => {
  await page.addInitScript(() => {
    const originalNow = Date.now.bind(Date);
    const clock = { offset: 0 };
    Object.defineProperty(window, 'qaFocusClock', { value: clock });
    Date.now = () => originalNow() + clock.offset;
  });
  await page.goto('./');
  await add(page, 'Остаться незавершённой');
  await page.getByRole('button', { name: 'Режим фокуса', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Режим фокуса', exact: true });
  await dialog.getByRole('button', { name: 'Начать', exact: true }).click();
  await page.evaluate(() => { (window as unknown as { qaFocusClock: { offset: number } }).qaFocusClock.offset = 25 * 60 * 1000 + 5000; });
  await expect(dialog.getByText('Сессия завершена', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('timer')).toHaveText('00:00');
  expect((await savedTasks(page))[0]?.completed).toBe(false);
  await dialog.getByRole('button', { name: 'Начать заново', exact: true }).click();
  await expect(dialog.getByRole('timer')).toHaveText('25:00');
  expect((await savedTasks(page))[0]?.completed).toBe(false);
});

test('filters and inline editing preserve identity, order and a visible focus after undo', async ({ page }) => {
  await page.goto('./');
  await add(page, 'Уточнить формулировку');
  await add(page, 'Проверить результат');
  await page.getByRole('checkbox', { name: 'Проверить результат', exact: true }).check();
  const before = await savedTasks(page);
  await page.getByRole('button', { name: 'В работе', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(page.getByRole('checkbox')).toHaveAccessibleName('Уточнить формулировку');
  await page.getByRole('button', { name: 'Изменить задачу «Уточнить формулировку»' }).click();
  const editor = page.getByRole('textbox', { name: 'Название задачи', exact: true });
  await expect(editor).toBeFocused();
  await editor.fill('Подготовить итоговое предложение');
  await editor.press('Enter');
  await expect(page.getByRole('button', { name: 'Изменить задачу «Подготовить итоговое предложение»' })).toBeFocused();
  const renamed = await savedTasks(page);
  expect(renamed).toEqual(before.map((task) => task.title === 'Уточнить формулировку'
    ? { ...task, title: 'Подготовить итоговое предложение' }
    : task));

  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Подготовить итоговое предложение', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Готовые', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  // The row leaves the filtered view immediately, so verify its saved state after the click.
  await page.getByRole('checkbox', { name: 'Проверить результат', exact: true }).click();
  expect((await savedTasks(page)).find((task) => task.title === 'Проверить результат')?.completed).toBe(false);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Новая задача', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Все', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Подготовить итоговое предложение', exact: true }).check();
  const beforeRemoval = await savedTasks(page);
  await page.getByRole('button', { name: 'Удалить задачу «Подготовить итоговое предложение»' }).click();
  await page.getByRole('button', { name: 'В работе', exact: true }).click();
  await page.getByRole('button', { name: 'Вернуть', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Все', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('checkbox', { name: 'Подготовить итоговое предложение', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Подготовить итоговое предложение', exact: true })).toBeFocused();
  expect(await savedTasks(page)).toEqual(beforeRemoval);
});
