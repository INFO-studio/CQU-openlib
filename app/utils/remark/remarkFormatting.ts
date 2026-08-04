import type { Mn, MnRoot } from '~/types/mdast';
import { mapTextNodes } from '~/utils/remark/mapTextNodes';

/** dotAll so a soft-wrapped paragraph still matches; a text node never spans one. */
const MARKER_RE = /({==.*?==})|({!!.*?!!})|({--.*?--})/gs;

const parseFormatting = (value: string): Mn[] => {
  let lastIndex = 0;
  const parts: Mn[] = [];

  value.replace(MARKER_RE, (match, _highlight, _danger, _delete, offset) => {
    if (offset > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, offset) });
    }

    const content = match.slice(3, -3);
    if (match.startsWith('{==')) {
      parts.push({ type: 'highlight', children: parseFormatting(content) });
    } else if (match.startsWith('{!!')) {
      parts.push({
        type: 'highlight',
        tone: 'danger',
        children: parseFormatting(content),
      });
    } else {
      parts.push({
        type: 'strikethrough',
        children: parseFormatting(content),
      });
    }

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
