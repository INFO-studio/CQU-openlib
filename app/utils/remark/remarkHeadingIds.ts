import { match } from 'ts-pattern';
import type { Mn, MnRoot } from '~/types/mdast';
import { slugify, textFromChildren } from '~/utils/headingText';

export const assignHeadingIds = (root: MnRoot): MnRoot => {
  // Keep allocation state local to one document; copying it per node is quadratic.
  const used = new Set<string>();
  const suffixes = new Map<string, number>();
  const availableId = (base: string, suffix: number): string => {
    const candidate = suffix === 0 ? base : `${base}_${suffix}`;
    if (used.has(candidate)) return availableId(base, suffix + 1);
    used.add(candidate);
    suffixes.set(base, suffix + 1);
    return candidate;
  };
  const headingId = (children: Mn[]): string | undefined => {
    const base = slugify(textFromChildren(children));
    return base ? availableId(base, suffixes.get(base) ?? 0) : undefined;
  };
  const mapNodes = (nodes: Mn[]): Mn[] => nodes.map(mapNode);
  const mapNode = (node: Mn): Mn =>
    match(node)
      .with({ type: 'heading' }, (heading) => ({
        ...heading,
        id: headingId(heading.children),
      }))
      .with({ type: 'tabs' }, { type: 'collapseGroup' }, (group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          children: mapNodes(item.children),
        })),
      }))
      .otherwise((parent) =>
        'children' in parent && Array.isArray(parent.children)
          ? ({ ...parent, children: mapNodes(parent.children) } as Mn)
          : parent,
      );
  return {
    ...root,
    ...(root.children ? { children: mapNodes(root.children) } : {}),
  };
};

const remarkHeadingIds = () => (tree: MnRoot) => {
  tree.children = assignHeadingIds(tree).children;
};

export default remarkHeadingIds;
