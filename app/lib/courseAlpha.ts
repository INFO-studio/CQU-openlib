import type { SidebarNode } from '~/lib/nav';
// Vite loads this module before the app's path aliases are available.
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

const flattenLeaves = (nodes: SidebarNode[]): SidebarNode[] =>
  nodes.flatMap((node) =>
    node.children?.length ? flattenLeaves(node.children) : [node],
  );

export const groupCoursesByAlpha = (tree: SidebarNode[]): AlphaGroup[] => {
  const leaves = flattenLeaves(tree);
  return ALPHA_LETTERS.map((letter) => ({
    letter,
    items: leaves
      .filter((item) => (item.letter ?? '#') === letter)
      .sort((a, b) => compareTitles(a.title, b.title)),
  })).filter(({ items }) => items.length > 0);
};
