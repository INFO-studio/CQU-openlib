import type { SidebarNode } from '~/lib/nav';
// Relative: this module is loaded by vite.config.ts, where `~` is not resolved.
import { compareTitles } from './titleOrder';
export const ALPHA_LETTERS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  '#',
] as const;
export type AlphaLetter = (typeof ALPHA_LETTERS)[number];
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
    // Baked in at build time by vite/doc-nav-index.
    const letter = item.letter ?? '#';
    const list = buckets.get(letter) ?? [];
    list.push(item);
    buckets.set(letter, list);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => compareTitles(a.title, b.title));
  }
  return ALPHA_LETTERS.filter((letter) => buckets.has(letter)).map(
    (letter) => ({
      letter,
      items: buckets.get(letter) ?? [],
    }),
  );
};
