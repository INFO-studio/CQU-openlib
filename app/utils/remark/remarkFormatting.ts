import type { Mn, MnRoot, MnText } from '~/types/mdast';

const isText = (n: Mn): n is MnText => n.type === 'text';

const parseFormatting = (value: string): Mn[] => {
  const regex = /({==.*?==})|({--.*?--})/g;
  let lastIndex = 0;
  const parts: Mn[] = [];

  value.replace(regex, (match, _1, _2, offset) => {
    if (offset > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, offset) });
    }

    const content = match.slice(3, -3);
    parts.push(
      match.startsWith('{==')
        ? { type: 'highlight', children: parseFormatting(content) }
        : { type: 'strikethrough', children: parseFormatting(content) },
    );

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }

  return parts;
};

const recursivelyFormat = (nodes?: Mn[]): Mn[] =>
  (nodes ?? []).flatMap((node) =>
    isText(node)
      ? parseFormatting(node.value)
      : 'children' in node
        ? [{ ...node, children: recursivelyFormat(node.children) }]
        : [node],
  );

const remarkFormatting = () => (tree: MnRoot) => {
  tree.children = recursivelyFormat(tree.children ?? []);
};

export default remarkFormatting;
