import { describe, expect, it } from 'vitest';
import {
  MAX_TASK_TITLE_LENGTH,
  validateTaskTitle,
} from '../src/features/tasks/model';

describe('validateTaskTitle', () => {
  it.each(['', '   ', '\t\n', '\u00a0'])('rejects an empty draft %j', (input) => {
    expect(validateTaskTitle(input)).toEqual({ ok: false, error: 'empty' });
  });

  it('trims outer whitespace while preserving the title and internal spaces', () => {
    expect(validateTaskTitle('  Подготовить  отчёт 🧪  ')).toEqual({
      ok: true,
      title: 'Подготовить  отчёт 🧪',
    });
  });

  it('accepts the maximum length after trimming', () => {
    const title = 'я'.repeat(MAX_TASK_TITLE_LENGTH);

    expect(validateTaskTitle(`  ${title}  `)).toEqual({ ok: true, title });
  });

  it('rejects a title exceeding the limit instead of truncating it', () => {
    expect(validateTaskTitle('я'.repeat(MAX_TASK_TITLE_LENGTH + 1))).toEqual({
      ok: false,
      error: 'too-long',
    });
  });

  it('uses UTF-16 units consistently with an HTML input maxlength', () => {
    const title = '📝'.repeat(MAX_TASK_TITLE_LENGTH / 2);

    expect(validateTaskTitle(title)).toEqual({ ok: true, title });
    expect(validateTaskTitle(`${title}а`)).toEqual({ ok: false, error: 'too-long' });
  });
});
