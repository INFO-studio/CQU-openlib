import { TAB_ITEM, TABS_END, TABS_START } from '~/consts/placeholders';
import type { Mn, MnParagraph, MnRoot, MnTabs, MnText } from '~/types/mdast';

const isHtml = (n: Mn, value: string) => n.type === 'html' && n.value === value;

/** `=== "Title"` / `=== 'Title'` at the start of a tab marker line. */
const TAB_MARKER = /^===\s*(["'])([^"']*)\1\s*/;

/**
 * Soft-break may glue the marker line to the next indented body line into one
 * paragraph (codeIndented is disabled). Only the marker is the title; the rest
 * stays as tab body.
 */
const splitTabMarkerParagraph = (
  children: Mn[],
): { title: Mn[]; body: MnParagraph | null } => {
  const first = children[0];
  if (!first || first.type !== 'text' || !first.value) {
    return { title: [{ type: 'text', value: 'Tab' }], body: null };
  }

  const m = first.value.match(TAB_MARKER);
  if (!m) {
    return { title: [{ type: 'text', value: 'Tab' }], body: null };
  }

  const title: Mn[] = [{ type: 'text', value: m[2] }];
  const rest: Mn[] = [];
  const after = first.value.slice(m[0].length);
  if (after.trim()) {
    rest.push({
      type: 'text',
      value: after.replace(/^\s+/, ''),
    } satisfies MnText);
  }

  let i = 1;
  if (!after.trim() && children[i]?.type === 'break') i += 1;
  rest.push(...children.slice(i));

  while (rest[0]?.type === 'break') rest.shift();
  if (rest[0]?.type === 'text') {
    const trimmed = rest[0].value.replace(/^\s+/, '');
    if (trimmed) rest[0] = { ...rest[0], value: trimmed };
    else rest.shift();
  }

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
