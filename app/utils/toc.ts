import type { Mn } from '~/types/mdast';
import { slugify, textFromChildren } from '~/utils/headingText';
export type TocItem = {
  id: string;
  text: string;
  level: number;
};
export const extractToc = (root: Mn): TocItem[] => {
  if (root.type !== 'root' || !root.children) return [];
  const items: TocItem[] = [];
  for (const node of root.children) {
    if (node.type !== 'heading') continue;
    const level = node.depth ?? 1;
    if (level < 2 || level > 3) continue;
    const text = textFromChildren(node.children);
    if (!text) continue;
    items.push({ id: slugify(text), text, level });
  }
  return items;
};
export const pageTitleFromAst = (root: Mn): string => {
  if (root.type !== 'root' || !root.children) return 'CQU-openlib';
  const h1 = root.children.find((n) => n.type === 'heading' && n.depth === 1);
  if (!h1 || h1.type !== 'heading') return 'CQU-openlib';
  return textFromChildren(h1.children) || 'CQU-openlib';
};
