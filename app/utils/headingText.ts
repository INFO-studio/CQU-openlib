import type { Mn } from '~/types/mdast';
export const slugify = (text: string) => {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '');
};
export const textFromChildren = (children?: Mn[]): string => {
  if (!children) return '';
  return children
    .map((c) => {
      if (c.type === 'text') return c.value ?? '';
      if ('children' in c && Array.isArray(c.children)) {
        return textFromChildren(c.children as Mn[]);
      }
      return '';
    })
    .join('');
};
