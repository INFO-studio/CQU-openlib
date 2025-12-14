import type { Mn, MnIcon, MnRoot, MnText } from '~/types/mdast';

const isText = (n: Mn): n is MnText => n.type === 'text';

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

const recursivelyParseIcons = (nodes?: Mn[]): Mn[] =>
  (nodes ?? []).flatMap((node) => {
    if (isText(node)) {
      return parseIcons(node.value);
    }
    if ('children' in node && node.children) {
      node.children = recursivelyParseIcons(node.children);
    }
    if ('title' in node && typeof node.title !== 'string') {
      node.title = recursivelyParseIcons(node.title ?? []);
    }
    return node;
  });

const remarkIcon = (): ((tree: MnRoot) => void) => (tree) => {
  tree.children = recursivelyParseIcons(tree.children);
};

export default remarkIcon;
