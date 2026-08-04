import type { Mn, MnText } from '~/types/mdast';

const isText = (n: Mn): n is MnText => n.type === 'text';

/**
 * Replace every text node in the tree with whatever `parse` returns for it.
 *
 * Tabs and collapse groups hold content in `items[]` instead of `children`,
 * and titles live in `title[]`, so a plain children walk silently skips both.
 * Inline syntax plugins share this walk rather than re-deriving containers.
 */
export const mapTextNodes = (
  nodes: Mn[] | undefined,
  parse: (value: string) => Mn[],
): Mn[] =>
  (nodes ?? []).flatMap((node): Mn[] => {
    if (isText(node)) return parse(node.value);

    if (node.type === 'tabs' || node.type === 'collapseGroup') {
      for (const item of node.items) {
        item.title = mapTextNodes(item.title, parse);
        item.children = mapTextNodes(item.children, parse);
      }
      return [node];
    }

    if ('children' in node && node.children) {
      node.children = mapTextNodes(node.children as Mn[], parse);
    }
    if ('title' in node && Array.isArray(node.title)) {
      node.title = mapTextNodes(node.title, parse);
    }
    return [node];
  });
