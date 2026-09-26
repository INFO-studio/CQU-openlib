import type { Mn } from '~/types/mdast';

export const mdastText = (nodes: readonly Mn[] | undefined): string =>
  (nodes ?? [])
    .map((node) => {
      if ('value' in node && typeof node.value === 'string') return node.value;
      if ('children' in node && Array.isArray(node.children)) {
        return mdastText(node.children);
      }
      return '';
    })
    .join('');
