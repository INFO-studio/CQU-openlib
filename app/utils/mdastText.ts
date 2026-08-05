import type { Mn } from '~/types/mdast';

/**
 * Best-effort plain text for a run of inline nodes.
 *
 * Used for labels and React keys, where the rendered markup is unavailable but
 * a readable string is wanted. Nodes that carry no text contribute nothing.
 */
export const mdastText = (nodes: readonly Mn[] | undefined): string => {
  if (!nodes?.length) return '';

  let out = '';
  for (const node of nodes) {
    if ('value' in node && typeof node.value === 'string') {
      out += node.value;
    } else if ('children' in node && Array.isArray(node.children)) {
      out += mdastText(node.children as Mn[]);
    }
  }
  return out;
};
