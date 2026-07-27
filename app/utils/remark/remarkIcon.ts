import type { Mn, MnIcon, MnRoot } from '~/types/mdast';
import { mapTextNodes } from '~/utils/remark/mapTextNodes';

const parseIcons = (value: string): Mn[] => {
  if (!value.length) return [];
  const regex = /:([A-Za-z0-9_-]+):/;
  const match = regex.exec(value);

  if (!match) return [{ type: 'text', value }];

  const [fullMatch, iconName] = match;
  const index = match.index ?? 0;

  const before: Mn[] =
    index > 0 ? [{ type: 'text', value: value.slice(0, index) }] : [];
  const icon: MnIcon[] = [{ type: 'icon', icon: iconName }];
  const after = value.slice(index + fullMatch.length);

  return [...before, ...icon, ...parseIcons(after)];
};

const remarkIcon = (): ((tree: MnRoot) => void) => (tree) => {
  tree.children = mapTextNodes(tree.children, parseIcons);
};

export default remarkIcon;
