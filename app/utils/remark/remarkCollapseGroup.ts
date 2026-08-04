import type { Mn, MnCollapseGroup, MnParagraph, MnRoot } from '~/types/mdast';
import {
  COLLAPSE_GROUP_END,
  COLLAPSE_GROUP_START,
  COLLAPSE_ITEM,
} from '~/utils/preprocess/placeholders';

const isHtml = (node: Mn, value: string) =>
  node.type === 'html' && node.value === value;

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

const trimTitleEnd = (nodes: Mn[]): Mn[] => {
  const title = [...nodes];
  const last = title.at(-1);
  if (last?.type === 'text') {
    const value = last.value.trimEnd();
    if (value) title[title.length - 1] = { ...last, value };
    else title.pop();
  }
  return title;
};

export const splitCollapseMarkerParagraph = (
  children: Mn[],
): { title: Mn[]; body: MnParagraph | null } => {
  const first = children[0];
  const match = first?.type === 'text' && first.value.match(/^\^\^\^\s+/);
  if (!match) {
    return { title: [{ type: 'text', value: '折叠项' }], body: null };
  }

  const firstRest = first.value.slice(match[0].length);
  const pending: Mn[] = [
    ...(firstRest ? [{ ...first, value: firstRest } as Mn] : []),
    ...children.slice(1),
  ];
  const title: Mn[] = [];
  const body: Mn[] = [];
  let inBody = false;

  for (const node of pending) {
    if (!inBody && node.type === 'break') {
      inBody = true;
      continue;
    }
    if (!inBody && node.type === 'text') {
      const newline = node.value.indexOf('\n');
      if (newline >= 0) {
        const before = node.value.slice(0, newline);
        const after = node.value.slice(newline + 1);
        if (before) title.push({ ...node, value: before });
        if (after) body.push({ ...node, value: after });
        inBody = true;
        continue;
      }
    }
    (inBody ? body : title).push(node);
  }

  return {
    title: trimTitleEnd(title),
    body: body.length
      ? { type: 'paragraph', children: trimLeadingBreaksAndSpace(body) }
      : null,
  };
};

type CollapseItem = MnCollapseGroup['items'][number];

const hasPendingTitle = (item: CollapseItem) =>
  item.title.length === 1 &&
  item.title[0]?.type === 'text' &&
  item.title[0].value === '折叠项';

const parseCollapseGroup = (
  nodes: Mn[],
  start: number,
): [MnCollapseGroup, number] => {
  const items: CollapseItem[] = [];
  let current: CollapseItem | null = null;
  let index = start;

  while (index < nodes.length) {
    const node = nodes[index]!;
    if (isHtml(node, COLLAPSE_GROUP_END)) {
      return [{ type: 'collapseGroup', items }, index + 1];
    }
    if (isHtml(node, COLLAPSE_GROUP_START)) {
      const [nested, next] = parseCollapseGroup(nodes, index + 1);
      if (current) current.children.push(nested);
      index = next;
      continue;
    }
    if (isHtml(node, COLLAPSE_ITEM)) {
      current = {
        title: [{ type: 'text', value: '折叠项' }],
        children: [],
      };
      items.push(current);
      index += 1;
      continue;
    }
    if (!current) {
      index += 1;
      continue;
    }
    if (
      current.children.length === 0 &&
      node.type === 'paragraph' &&
      hasPendingTitle(current)
    ) {
      const { title, body } = splitCollapseMarkerParagraph(node.children ?? []);
      current.title = title;
      if (body) current.children.push(body);
      index += 1;
      continue;
    }
    current.children.push(node);
    index += 1;
  }

  return [{ type: 'collapseGroup', items }, index];
};

const descend = (node: Mn): Mn => {
  switch (node.type) {
    case 'tabs':
    case 'collapseGroup':
      return {
        ...node,
        items: node.items.map((item) => ({
          ...item,
          children: convertCollapseGroups(item.children),
        })),
      };
    case 'admonition':
    case 'root':
      return {
        ...node,
        children: convertCollapseGroups(node.children ?? []),
      };
    case 'blockquote':
    case 'footnoteDefinition':
    case 'list':
    case 'listItem':
      return {
        ...node,
        children: convertCollapseGroups(node.children),
      };
    default:
      return node;
  }
};

const convertCollapseGroups = (nodes: Mn[]): Mn[] => {
  const out: Mn[] = [];
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index]!;
    if (isHtml(node, COLLAPSE_GROUP_START)) {
      const [group, next] = parseCollapseGroup(nodes, index + 1);
      out.push(descend(group));
      index = next;
      continue;
    }
    out.push(descend(node));
    index += 1;
  }
  return out;
};

const remarkCollapseGroup = () => (tree: MnRoot) => {
  tree.children = convertCollapseGroups(tree.children ?? []);
};

export default remarkCollapseGroup;
