import { TAB_ITEM, TABS_END, TABS_START } from '~/consts/placeholders';
import type { Mn, MnRoot, MnTabs, MnText } from '~/types/mdast';

const isHtml = (n: Mn, value: string) => n.type === 'html' && n.value === value;
export const extractTabTitle = (paragraphChildren: Mn[]): Mn[] => {
  const cloned: Mn[] = paragraphChildren.map((c) =>
    c.type === 'text' ? ({ ...c, value: c.value } satisfies MnText) : c,
  );
  const first = cloned.find((c) => c.type === 'text');
  if (first && first.type === 'text' && first.value) {
    first.value = first.value
      .replace(/^===\s*/, '')
      .replace(/^"/, '')
      .replace(/^'/, '');
  }
  for (let i = cloned.length - 1; i >= 0; i--) {
    const node = cloned[i];
    if (node.type === 'text' && node.value) {
      node.value = node.value.replace(/"\s*$/, '').replace(/'\s*$/, '');
      break;
    }
  }
  return cloned.filter(
    (c) => !(c.type === 'text' && !(c.value && c.value.length > 0)),
  );
};
type TabItem = MnTabs['items'][number];
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
      current.title.length === 1 &&
      current.title[0]?.type === 'text' &&
      current.title[0].value === 'Tab'
    ) {
      current.title = extractTabTitle(cur.children ?? []);
      i += 1;
      continue;
    }
    current.children.push(cur);
    i += 1;
  }
  return [{ type: 'tabs', items }, i];
};
export const convertTabsInNodes = (nodes: Mn[]): Mn[] => {
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
