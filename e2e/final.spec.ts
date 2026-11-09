import { expect, test, type Page } from '@playwright/test';

async function selectedHeading(page: Page) {
  return page.getByRole('heading', { level: 1 }).evaluate((heading) => {
    const selectedRange = document.createRange();
    selectedRange.selectNodeContents(heading);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(selectedRange);
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const fontSize = Number.parseFloat(getComputedStyle(heading).fontSize);
    const lines: Array<{ center: number; top: number; bottom: number }> = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width === 0 || rect.height === 0) continue;
        const center = (rect.top + rect.bottom) / 2;
        const line = lines.find((candidate) => Math.abs(candidate.center - center) < fontSize * 0.45);
        if (line) {
          line.top = Math.min(line.top, rect.top);
          line.bottom = Math.max(line.bottom, rect.bottom);
        } else lines.push({ center, top: rect.top, bottom: rect.bottom });
      }
    }
    lines.sort((a, b) => a.top - b.top);
    return {
      text: selection.toString(), lines,
      userSelect: getComputedStyle(heading).userSelect,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

test('data disclosure is keyboard accessible, closes naturally and explains a write failure honestly', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, 'headerWrites', { value: { count: 0 } });
    Storage.prototype.setItem = function (key, value) {
      if (key === 'todo-list:tasks:v1') (window as unknown as { headerWrites: { count: number } }).headerWrites.count += 1;
      return original.call(this, key, value);
    };
  });
  await page.goto('./');
  const details = page.locator('details');
  const summary = details.locator('summary');
  await expect(summary).toHaveAccessibleName('О данных');
  await summary.focus();
  await summary.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await expect(details.getByRole('heading', { name: 'Сохраняется в браузере', exact: true })).toBeVisible();
  await expect(details.getByText('На другом устройстве будет отдельный список. Очистка данных сайта удалит сохранённые задачи.', { exact: true })).toBeVisible();
  await summary.press('Escape');
  await expect(details).not.toHaveAttribute('open');
  await expect(summary).toBeFocused();
  await summary.press('Space');
  await expect(details).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Новая задача', exact: true })).toBeFocused();
  await expect(details).not.toHaveAttribute('open');
  await summary.click();
  await details.getByText('После обновления страницы задачи останутся в этом браузере.', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(details).not.toHaveAttribute('open');
  await summary.click();
  await page.getByRole('textbox', { name: 'Новая задача', exact: true }).click();
  await expect(details).not.toHaveAttribute('open');
  expect(await page.evaluate(() => (window as unknown as { headerWrites: { count: number } }).headerWrites.count)).toBe(0);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'todo-list:tasks:v1') throw new DOMException('Synthetic QA write failure', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('textbox', { name: 'Новая задача', exact: true }).fill('Остаться в памяти');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Остаться в памяти', exact: true })).toBeVisible();
  await expect(summary).toHaveAccessibleName('Не сохранено');
  await expect(page.getByText('Изменения не удалось сохранить. После обновления страницы они могут исчезнуть.', { exact: true })).toBeVisible();
  await summary.click();
  await expect(details.getByRole('heading', { name: 'Изменения не сохранены', exact: true })).toBeVisible();
  await expect(details.getByText('Пока изменения доступны в памяти страницы и могут исчезнуть после обновления.', { exact: true })).toBeVisible();
});

test('the two-line heading remains selectable without overlapping lines, including safe font fallback', async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
    const native = await selectedHeading(page);
    expect(native.text).toContain('Мои');
    expect(native.text).toContain('задачи');
    expect(native.userSelect).not.toBe('none');
    expect(native.lines).toHaveLength(2);
    expect(native.lines[1]!.top - native.lines[0]!.bottom).toBeGreaterThanOrEqual(-0.1);
    expect(native.overflow).toBe(0);
    await page.evaluate(() => {
      document.documentElement.classList.remove('font-metrics-supported');
      // Normal Literata metrics emulate a browser that ignores font metric overrides.
      document.querySelector('h1')!.style.fontFamily = 'Literata, Georgia, serif';
    });
    await page.evaluate(() => document.fonts.ready);
    const fallback = await selectedHeading(page);
    expect(fallback.lines).toHaveLength(2);
    expect(fallback.lines[1]!.top - fallback.lines[0]!.bottom).toBeGreaterThanOrEqual(-0.1);
    expect(fallback.text).toContain('задачи');
    expect(fallback.userSelect).not.toBe('none');
    expect(fallback.overflow).toBe(0);
  }
});
