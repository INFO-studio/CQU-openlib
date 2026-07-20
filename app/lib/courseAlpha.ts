import { pinyin } from 'pinyin-pro';
import type { SidebarNode } from '~/lib/nav';
export const ALPHA_LETTERS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  '#',
] as const;
export type AlphaLetter = (typeof ALPHA_LETTERS)[number];
const significantTitle = (title: string): string => {
  return title.replace(/^[\s"'“”‘’《》〈〉【】（）()[\]「」]+/u, '').trim();
};
export const letterOfTitle = (title: string): AlphaLetter => {
  const cleaned = significantTitle(title);
  const ch = cleaned[0];
  if (!ch) return '#';
  if (/[A-Za-z]/.test(ch)) return ch.toUpperCase() as AlphaLetter;
  if (/[0-9]/.test(ch)) return '#';
  const first = pinyin(ch, { pattern: 'first', toneType: 'none' });
  const letter = (first[0] ?? '').toUpperCase();
  if (/[A-Z]/.test(letter)) return letter as AlphaLetter;
  return '#';
};
export type AlphaGroup = {
  letter: AlphaLetter;
  items: SidebarNode[];
};
const flattenLeaves = (nodes: SidebarNode[]): SidebarNode[] => {
  const out: SidebarNode[] = [];
  for (const node of nodes) {
    if (node.children?.length) out.push(...flattenLeaves(node.children));
    else out.push(node);
  }
  return out;
};
export const groupCoursesByAlpha = (tree: SidebarNode[]): AlphaGroup[] => {
  const leaves = flattenLeaves(tree);
  const buckets = new Map<AlphaLetter, SidebarNode[]>();
  for (const item of leaves) {
    const letter = letterOfTitle(item.title);
    const list = buckets.get(letter) ?? [];
    list.push(item);
    buckets.set(letter, list);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) =>
      a.title.localeCompare(b.title, 'zh-CN', { sensitivity: 'base' }),
    );
  }
  return ALPHA_LETTERS.filter((letter) => buckets.has(letter)).map(
    (letter) => ({
      letter,
      items: buckets.get(letter) ?? [],
    }),
  );
};
