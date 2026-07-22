import { TAB_ITEM, TABS_END, TABS_START } from '~/consts/placeholders';
import type { Mn, MnParagraph, MnRoot, MnTabs, MnText } from '~/types/mdast';

const isHtml = (n: Mn, value: string) => n.type === 'html' && n.value === value;

/** `=== "Title"` / `=== 'Title'` at the start of a tab marker line. */
const TAB_MARKER = /^===\s*(["'])([^"']*)\1\s*/;

/**
 * Inline code (from `` `...` `` in the title) must round-trip so that
 * `:l-book:`MATH10821`` still matches TAB_MARKER after mdast splits it.
 */
export const serializedLen = (n: Mn): number | null => {
  if (n.type === 'text') return n.value.length;
  if (n.type === 'inlineCode') return n.value.length + 2;
  if (n.type === 'break') return 1;
  return null;
};

/** Re-join text / inlineCode / softbreak for marker matching. */
export const serializeInline = (children: Mn[]): string => {
  let out = '';
  for (const child of children) {
    if (child.type === 'text') out += child.value;
    else if (child.type === 'inlineCode') out += `\`${child.value}\``;
    else if (child.type === 'break') out += '\n';
    else break;
  }
  return out;
};

/** Nodes covering serialized character range [start, end). */
export const sliceSerialized = (
  children: Mn[],
  start: number,
  end: number,
): Mn[] => {
  if (end <= start) return [];
  const out: Mn[] = [];
  let cursor = 0;
  for (const child of children) {
    const len = serializedLen(child);
    if (len == null) break;
    const nodeStart = cursor;
    const nodeEnd = cursor + len;
    cursor = nodeEnd;
    if (nodeEnd <= start) continue;
    if (nodeStart >= end) break;

    if (child.type === 'text') {
      const value = child.value.slice(
        Math.max(0, start - nodeStart),
        Math.min(child.value.length, end - nodeStart),
      );
      if (value) out.push({ type: 'text', value } satisfies MnText);
      continue;
    }

    if (child.type === 'inlineCode') {
      if (start <= nodeStart && end >= nodeEnd) {
        out.push({ type: 'inlineCode', value: child.value });
      } else {
        const full = `\`${child.value}\``;
        const value = full.slice(
          Math.max(0, start - nodeStart),
          Math.min(len, end - nodeStart),
        );
        if (value) out.push({ type: 'text', value } satisfies MnText);
      }
    }

    // softbreak inside title / body slice: skip
  }
  return out;
};

/** Drop the first `offset` serialized characters; keep the rest of the tree. */
export const dropSerializedPrefix = (children: Mn[], offset: number): Mn[] => {
  if (offset <= 0) return children;
  let cursor = 0;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]!;
    const len = serializedLen(child);
    if (len == null) return children.slice(i);
    if (cursor + len <= offset) {
      cursor += len;
      continue;
    }
    if (cursor >= offset) return children.slice(i);

    const local = offset - cursor;
    const rest: Mn[] = [];
    if (child.type === 'text') {
      const value = child.value.slice(local);
      if (value) rest.push({ type: 'text', value } satisfies MnText);
    } else if (child.type === 'inlineCode') {
      const full = `\`${child.value}\``;
      const value = full.slice(local);
      if (value) rest.push({ type: 'text', value } satisfies MnText);
    } else if (child.type === 'break' && local === 0) {
      rest.push(child);
    }
    rest.push(...children.slice(i + 1));
    return rest;
  }
  return [];
};

const trimLeadingBreaksAndSpace = (nodes: Mn[]): Mn[] => {
  const rest = [...nodes];
  while (rest[0]?.type === 'break') rest.shift();
  if (rest[0]?.type === 'text') {
    const trimmed = rest[0].value.replace(/^\s+/, '');
    if (trimmed) rest[0] = { ...rest[0], value: trimmed };
    else rest.shift();
  }
  return rest;
};

/**
 * Soft-break may glue the marker line to the next indented body line into one
 * paragraph (codeIndented is disabled). Only the marker is the title; the rest
 * stays as tab body.
 *
 * Titles often contain icon syntax with backticks (`:l-book:`CODE``), which
 * remarkParse splits into text + inlineCode — match against the re-serialized
 * line, not only the first text node.
 */
export const splitTabMarkerParagraph = (
  children: Mn[],
): { title: Mn[]; body: MnParagraph | null } => {
  if (!children.length) {
    return { title: [{ type: 'text', value: 'Tab' }], body: null };
  }

  const flat = serializeInline(children);
  const m = flat.match(TAB_MARKER);
  if (!m) {
    return { title: [{ type: 'text', value: 'Tab' }], body: null };
  }

  const openQuoteIndex = m[0].indexOf(m[1]!);
  const titleStart = openQuoteIndex + 1;
  const titleEnd = titleStart + m[2]!.length;
  const markerEnd = m[0].length;

  let title = sliceSerialized(children, titleStart, titleEnd);
  if (!title.length) {
    title = [{ type: 'text', value: m[2]! }];
  }

  const rest = trimLeadingBreaksAndSpace(
    dropSerializedPrefix(children, markerEnd),
  );
  if (!rest.length) return { title, body: null };
  return { title, body: { type: 'paragraph', children: rest } };
};

type TabItem = MnTabs['items'][number];

const isPendingTitle = (item: TabItem) =>
  item.title.length === 1 &&
  item.title[0]?.type === 'text' &&
  item.title[0].value === 'Tab';

const parseTabsGroup = (nodes: Mn[], start: number): [MnTabs, number] => {
  const items: TabItem[] = [];
  let current: TabItem | null = null;
  let i = start;
  while (i < nodes.length) {
    const cur = nodes[i]!;
    if (isHtml(cur, TABS_END)) {
      return [{ type: 'tabs', items }, i + 1];
    }
    if (isHtml(cur, TABS_START)) {
      const [nested, next] = parseTabsGroup(nodes, i + 1);
      if (current) current.children.push(nested);
      i = next;
      continue;
    }
    if (isHtml(cur, TAB_ITEM)) {
      current = {
        title: [{ type: 'text', value: 'Tab' }],
        children: [],
      };
      items.push(current);
      i += 1;
      continue;
    }
    if (!current) {
      i += 1;
      continue;
    }
    if (cur.type === 'html' && cur.value === '<!-- TAB -->') {
      i += 1;
      continue;
    }
    if (
      current.children.length === 0 &&
      cur.type === 'paragraph' &&
      isPendingTitle(current)
    ) {
      const { title, body } = splitTabMarkerParagraph(cur.children ?? []);
      current.title = title;
      if (body) current.children.push(body);
      i += 1;
      continue;
    }
    current.children.push(cur);
    i += 1;
  }
  return [{ type: 'tabs', items }, i];
};

const convertTabsInNodes = (nodes: Mn[]): Mn[] => {
  const out: Mn[] = [];
  let i = 0;
  while (i < nodes.length) {
    const cur = nodes[i]!;
    if (isHtml(cur, TABS_START)) {
      const [tabs, next] = parseTabsGroup(nodes, i + 1);
      out.push(tabs);
      i = next;
      continue;
    }
    out.push(cur);
    i += 1;
  }
  return out;
};

const remarkContentTabs = () => (tree: MnRoot) => {
  tree.children = convertTabsInNodes(tree.children ?? []);
};

export default remarkContentTabs;
