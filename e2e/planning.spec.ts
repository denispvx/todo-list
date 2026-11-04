import { expect, test, type Page } from '@playwright/test';

const tasksKey = 'todo-list:tasks:v1';
type SavedTask = {
  id: string;
  title: string;
  completed: boolean;
  important?: boolean;
  urgency?: 'none' | 'urgent' | 'later';
  dueDate?: string;
};

async function savedTasks(page: Page): Promise<SavedTask[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).tasks, tasksKey);
}

async function seedAndCountWrites(page: Page, tasks: SavedTask[]) {
  await page.addInitScript(({ key, records }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, tasks: records }));
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, 'planningWrites', { value: { count: 0 } });
    Storage.prototype.setItem = function (itemKey, value) {
      if (itemKey === key) (window as unknown as { planningWrites: { count: number } }).planningWrites.count += 1;
      return original.call(this, itemKey, value);
    };
  }, { key: tasksKey, records: tasks });
}

async function writeCount(page: Page) {
  return page.evaluate(() => (window as unknown as { planningWrites: { count: number } }).planningWrites.count);
}

async function createPlannedTask(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'Новая задача', exact: true }).fill(title);
  await page.getByRole('button', { name: 'Срок и приоритет', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Важно', exact: true }).check();
  await page.getByRole('combobox', { name: 'Срочность', exact: true }).selectOption({ label: 'Срочно' });
  await page.getByLabel('Срок', { exact: true }).fill('2028-02-29');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
}

test('legacy version one tasks mount without a write or invented planning fields', async ({ page }) => {
  const legacy = [
    { id: 'legacy-a', title: 'Старая задача', completed: false },
    { id: 'legacy-b', title: 'Сохранённая выполненная', completed: true },
  ];
  await seedAndCountWrites(page, legacy);
  await page.goto('./');
  await expect(page.getByRole('checkbox', { name: 'Старая задача', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Сохранённая выполненная', exact: true })).toBeChecked();
  expect(await savedTasks(page)).toEqual(legacy);
  expect(await writeCount(page)).toBe(0);
  await page.getByRole('combobox', { name: 'Порядок задач', exact: true }).selectOption({ label: 'По сроку' });
  await page.getByRole('combobox', { name: 'Порядок задач', exact: true }).selectOption({ label: 'Сначала важные' });
  expect(await savedTasks(page)).toEqual(legacy);
  expect(await writeCount(page)).toBe(0);
});

test('importance, urgency and a calendar date survive creation and reload', async ({ page }) => {
  await page.goto('./');
  await createPlannedTask(page, 'Подготовить важное предложение');
  const saved = await savedTasks(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toEqual({
    id: expect.any(String), title: 'Подготовить важное предложение', completed: false,
    important: true, urgency: 'urgent', dueDate: '2028-02-29',
  });
  await expect(page.getByRole('checkbox', { name: 'Подготовить важное предложение', exact: true })).not.toBeChecked();
  await page.reload();
  expect(await savedTasks(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Изменить задачу «Подготовить важное предложение»' }).click();
  const editor = page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Название задачи', exact: true }) });
  await expect(editor.getByRole('checkbox', { name: 'Важно', exact: true })).toBeChecked();
  await expect(editor.getByRole('combobox', { name: 'Срочность', exact: true })).toHaveValue('urgent');
  await expect(editor.getByLabel('Срок', { exact: true })).toHaveValue('2028-02-29');
});

test('editing, undo and clearing metadata preserve task identity and completion', async ({ page }) => {
  await page.goto('./');
  await createPlannedTask(page, 'План встречи');
  await page.getByRole('checkbox', { name: 'План встречи', exact: true }).check();
  const original = (await savedTasks(page))[0]!;
  await page.getByRole('button', { name: 'Изменить задачу «План встречи»' }).click();
  const editor = page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Название задачи', exact: true }) });
  await editor.getByRole('textbox', { name: 'Название задачи', exact: true }).fill('Итоговый план встречи');
  await editor.getByRole('checkbox', { name: 'Важно', exact: true }).uncheck();
  await editor.getByRole('combobox', { name: 'Срочность', exact: true }).selectOption({ label: 'Не срочно' });
  await editor.getByLabel('Срок', { exact: true }).fill('2027-01-20');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const changed = { id: original.id, title: 'Итоговый план встречи', completed: true, urgency: 'later', dueDate: '2027-01-20' };
  expect(await savedTasks(page)).toEqual([changed]);
  await page.getByRole('button', { name: 'Удалить задачу «Итоговый план встречи»' }).click();
  await page.getByRole('button', { name: 'Вернуть', exact: true }).click();
  expect(await savedTasks(page)).toEqual([changed]);
  await expect(page.getByRole('checkbox', { name: 'Итоговый план встречи', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Итоговый план встречи', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Изменить задачу «Итоговый план встречи»' }).click();
  await editor.getByRole('combobox', { name: 'Срочность', exact: true }).selectOption({ label: 'Не задана' });
  await editor.getByRole('button', { name: 'Убрать срок', exact: true }).click();
  await expect(editor.getByLabel('Срок', { exact: true })).toHaveValue('');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const cleared = { id: original.id, title: changed.title, completed: true };
  expect(await savedTasks(page)).toEqual([cleared]);
  await page.reload();
  expect(await savedTasks(page)).toEqual([cleared]);
});

test('sorting changes the view without rewriting the saved task array', async ({ page }) => {
  const original: SavedTask[] = [
    { id: 'plain', title: 'Без срока', completed: false },
    { id: 'late', title: 'Более поздняя', completed: false, urgency: 'later', dueDate: '2027-02-01' },
    { id: 'urgent', title: 'Важная срочная', completed: false, important: true, urgency: 'urgent', dueDate: '2027-01-20' },
    { id: 'near', title: 'Ближайший срок', completed: false, dueDate: '2027-01-10' },
  ];
  await seedAndCountWrites(page, original);
  await page.goto('./');
  const order = page.getByRole('combobox', { name: 'Порядок задач', exact: true });
  await order.selectOption({ label: 'По сроку' });
  await expect(page.getByRole('checkbox').nth(0)).toHaveAccessibleName('Ближайший срок');
  await expect(page.getByRole('checkbox').nth(1)).toHaveAccessibleName('Важная срочная');
  await expect(page.getByRole('checkbox').nth(2)).toHaveAccessibleName('Более поздняя');
  await expect(page.getByRole('checkbox').nth(3)).toHaveAccessibleName('Без срока');
  await order.selectOption({ label: 'Сначала важные' });
  await expect(page.getByRole('checkbox').nth(0)).toHaveAccessibleName('Важная срочная');
  expect(await savedTasks(page)).toEqual(original);
  expect(await writeCount(page)).toBe(0);
  await page.getByRole('checkbox', { name: 'Важная срочная', exact: true }).check();
  expect(await savedTasks(page)).toEqual(original.map((task) => task.id === 'urgent' ? { ...task, completed: true } : task));
  expect(await writeCount(page)).toBe(1);
  await order.selectOption({ label: 'Как добавлены' });
  for (let index = 0; index < original.length; index += 1) {
    await expect(page.getByRole('checkbox').nth(index)).toHaveAccessibleName(original[index]!.title);
  }
});
