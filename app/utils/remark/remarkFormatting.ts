import type { Mn, MnRoot } from '~/types/mdast';
import { mapTextNodes } from '~/utils/remark/mapTextNodes';

/** dotAll so a soft-wrapped paragraph still matches; a text node never spans one. */
const MARKER_RE = /({==.*?==})|({--.*?--})/gs;

const parseFormatting = (value: string): Mn[] => {
  let lastIndex = 0;
  const parts: Mn[] = [];

  value.replace(MARKER_RE, (match, _1, _2, offset) => {
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

const remarkFormatting = () => (tree: MnRoot) => {
  tree.children = mapTextNodes(tree.children, parseFormatting);
};

export default remarkFormatting;
