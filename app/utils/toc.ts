import type { Mn } from '~/types/mdast';
import { slugify, textFromChildren } from '~/utils/headingText';

export type TocItem = {
  id: string;
  text: string;
  level: number;
  indent: number;
};

type TocHeading = Omit<TocItem, 'indent'>;

export const extractToc = (root: Mn): TocItem[] => {
  if (root.type !== 'root') return [];

  const headings: TocHeading[] = (root.children ?? []).flatMap((node) => {
    if (node.type !== 'heading' || node.depth === 1) return [];
    const text = textFromChildren(node.children);
    return text
      ? [{ id: node.id ?? slugify(text), text, level: node.depth }]
      : [];
  });
  const levels = [...new Set(headings.map(({ level }) => level))].sort(
    (left, right) => left - right,
  );
  const indentByLevel = new Map(
    levels.map((level, indent) => [level, indent] as const),
  );

  return headings.map((heading) => ({
    ...heading,
    indent: indentByLevel.get(heading.level) ?? 0,
  }));
};

export const pageTitleFromAst = (root: Mn): string => {
  if (root.type !== 'root') return 'CQU-openlib';
  const h1 = root.children?.find(
    (node) => node.type === 'heading' && node.depth === 1,
  );
  return h1?.type === 'heading'
    ? textFromChildren(h1.children) || 'CQU-openlib'
    : 'CQU-openlib';
};
