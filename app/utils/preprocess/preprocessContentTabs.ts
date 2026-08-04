import type { Preprocess } from '~/utils/preprocess/index';
import {
  COLLAPSE_GROUP_END,
  COLLAPSE_GROUP_START,
  COLLAPSE_ITEM,
  TAB,
  TAB_ITEM,
  TABS_END,
  TABS_START,
} from '~/utils/preprocess/placeholders';

/** Indent width of a content-tab head (`=== ...`), or null if not a head. */
export const tabHead = (line: string): number | null => {
  const m = line.match(/^(\s*)===\s+\S/);
  if (!m) return null;
  return m[1].replace(/\t/g, '    ').length;
};

/** Indent width of a collapse head (`^^^ Title`), or null if not a head. */
export const collapseHead = (line: string): number | null => {
  const m = line.match(/^(\s*)\^\^\^\s+\S/);
  if (!m) return null;
  return m[1].replace(/\t/g, '    ').length;
};

/** Leading indent in spaces (`\\t` → 4). */
export const lineIndent = (line: string): number => {
  const m = line.match(/^(\s*)/);
  return (m?.[1] ?? '').replace(/\t/g, '    ').length;
};

type GroupKind = 'tabs' | 'collapse';

type Group = {
  kind: GroupKind;
  indent: number;
};

const TOKENS = {
  tabs: { start: TABS_START, end: TABS_END, item: TAB_ITEM },
  collapse: {
    start: COLLAPSE_GROUP_START,
    end: COLLAPSE_GROUP_END,
    item: COLLAPSE_ITEM,
  },
} as const;

const groupHead = (
  line: string,
): { kind: GroupKind; indent: number } | null => {
  const tabsIndent = tabHead(line);
  if (tabsIndent != null) return { kind: 'tabs', indent: tabsIndent };
  const collapseIndent = collapseHead(line);
  if (collapseIndent != null) {
    return { kind: 'collapse', indent: collapseIndent };
  }
  return null;
};

/**
 * Group consecutive content tabs (`===`) and collapses (`^^^`) by indentation.
 * Handling both syntaxes in one pass preserves nesting between the two kinds.
 */
const preprocessContentTabs: Preprocess = (lines) => {
  const out: string[] = [];
  const stack: Group[] = [];

  const closeTop = () => {
    const top = stack.pop();
    if (top) out.push(TOKENS[top.kind].end);
  };

  const closeWhile = (shouldClose: (group: Group) => boolean) => {
    while (stack.length && shouldClose(stack[stack.length - 1]!)) closeTop();
  };

  for (const cur of lines) {
    if (cur === TAB) {
      out.push(cur);
      continue;
    }

    const head = groupHead(cur);
    if (head) {
      closeWhile((group) => group.indent > head.indent);
      if (
        stack.at(-1)?.indent === head.indent &&
        stack.at(-1)?.kind !== head.kind
      ) {
        closeTop();
      }
      if (!stack.length || stack.at(-1)!.indent < head.indent) {
        out.push(TOKENS[head.kind].start);
        stack.push(head);
      }
      out.push(TOKENS[head.kind].item, cur);
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
    // Content whose indent is not deeper than the current head leaves its group.
    closeWhile((group) => group.indent >= indent);
    out.push(cur);
  }

  while (stack.length) closeTop();

  return out;
};

export default preprocessContentTabs;
