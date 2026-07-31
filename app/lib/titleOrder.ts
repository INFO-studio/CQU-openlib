/**
 * Ordering rules shared by the sidebar tree, the A–Z course groups and the
 * search chunks, so a title lands in the same place everywhere.
 */

/**
 * Course names arrive from the training plans wrapped in decoration — 《》, ""
 * , stray spaces — that readers do not spell out when they look for a title.
 * Dropping every non-letter/non-digit character makes `《锅炉原理》课程设计`
 * sort next to `锅炉` rather than ahead of the whole G group. Titles made
 * entirely of punctuation keep their raw form so the key is never empty.
 */
export const significantTitle = (title: string): string =>
  title.replace(/[^\p{L}\p{N}]/gu, '') || title;

/**
 * zh-CN collation orders Han before Latin, which buries `Python程序设计` at the
 * bottom of the P group. Latin-initial titles read as their own alphabet, so
 * they lead instead.
 */
const scriptRank = (key: string): number => (/^[A-Za-z]/.test(key) ? 0 : 1);

export const compareTitles = (a: string, b: string): number => {
  const keyA = significantTitle(a);
  const keyB = significantTitle(b);
  const byScript = scriptRank(keyA) - scriptRank(keyB);
  if (byScript !== 0) return byScript;
  return (
    keyA.localeCompare(keyB, 'zh-CN', { sensitivity: 'base' }) ||
    // Keeps titles that differ only in punctuation (C++ vs C) deterministic.
    a.localeCompare(b, 'zh-CN')
  );
};
