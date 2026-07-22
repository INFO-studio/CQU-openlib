import { TAB, TAB_ITEM, TABS_END, TABS_START } from '~/consts/placeholders';
import type { Preprocess } from '~/utils/preprocess/index';

/** Indent width of a content-tab head (`=== ...`), or null if not a head. */
export const tabHead = (line: string): number | null => {
  const m = line.match(/^(\s*)===\s+\S/);
  if (!m) return null;
  return m[1].replace(/\t/g, '    ').length;
};

/** Leading indent in spaces (`\\t` → 4). */
export const lineIndent = (line: string): number => {
  const m = line.match(/^(\s*)/);
  return (m?.[1] ?? '').replace(/\t/g, '    ').length;
};

/**
 * Support nested Material content-tabs by indent:
 * === "A"
 *     === "A1"
 *         body
 */
const preprocessContentTabs: Preprocess = (lines) => {
  const out: string[] = [];
  const stack: number[] = [];

  const closeDeeperThan = (indent: number) => {
    while (stack.length && stack[stack.length - 1]! > indent) {
      out.push(TABS_END);
      stack.pop();
    }
  };

  const closeToInclusive = (indent: number) => {
    while (stack.length && stack[stack.length - 1]! >= indent) {
      out.push(TABS_END);
      stack.pop();
    }
  };

  for (const cur of lines) {
    if (cur === TAB) {
      out.push(cur);
      continue;
    }

    const headIndent = tabHead(cur);
    if (headIndent != null) {
      closeDeeperThan(headIndent);
      if (!stack.length || stack[stack.length - 1]! < headIndent) {
        out.push(TABS_START);
        stack.push(headIndent);
      }
      out.push(TAB_ITEM, cur);
      continue;
    }

    if (!stack.length) {
      out.push(cur);
      continue;
    }

    if (cur.trim() === '') {
      out.push(cur);
      continue;
    }

    const indent = lineIndent(cur);
    // Content whose indent is not deeper than the current tab head leaves that group.
    closeToInclusive(indent);
    out.push(cur);
  }

  while (stack.length) {
    out.push(TABS_END);
    stack.pop();
  }

  return out;
};

export default preprocessContentTabs;
