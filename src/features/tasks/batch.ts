import { validateTaskTitle } from './model';
import type { TitleError } from './model';

export const MAX_BATCH_TASKS = 50;

export type BatchLine = Readonly<{
  lineNumber: number;
  title: string;
  error: TitleError | null;
}>;

export type BatchPreview = Readonly<{
  lines: readonly BatchLine[];
  total: number;
  tooMany: boolean;
  valid: boolean;
}>;

const listMarker = /^(?:(?:[-*•]\s+)?\[[ xX]\](?:\s+|$)|[-*•](?:\s+|$)|\d+[.)](?:\s+|$))/;

export function parseBatchDraft(text: string): BatchPreview {
  const lines: BatchLine[] = [];
  let total = 0;

  for (const [index, source] of text.split(/\r\n?|\n/).entries()) {
    const title = source.trimStart().replace(listMarker, '').trim();
    if (title.length === 0) continue;

    total += 1;
    if (lines.length === MAX_BATCH_TASKS) continue;

    const result = validateTaskTitle(title);
    lines.push({
      lineNumber: index + 1,
      title,
      error: result.ok ? null : result.error,
    });
  }

  const tooMany = total > MAX_BATCH_TASKS;
  return {
    lines,
    total,
    tooMany,
    valid: total > 0 && !tooMany && lines.every((line) => line.error === null),
  };
}
