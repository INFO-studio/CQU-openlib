import { kbdKeyLabel, splitKbdTokens } from '~/lib/kbdKeys';
import type { Mn, MnKbd, MnRoot } from '~/types/mdast';
import { mapTextNodes } from '~/utils/remark/mapTextNodes';

/**
 * pymdownx.keys: `++ctrl+f++`, `++cmd+spc++`, `++win+i++`, `++plus++`
 * Only runs on text nodes (skips fenced / inline code).
 */
const KEYS_RE =
  /\+\+((?:[A-Za-z0-9_.-]+|"[^"]+"|'[^']+')(?:\+(?:[A-Za-z0-9_.-]+|"[^"]+"|'[^']+'))*)\+\+/g;

const parseKeys = (value: string): Mn[] => {
  if (!value.length) return [];
  const parts: Mn[] = [];
  let last = 0;
  KEYS_RE.lastIndex = 0;
  let m = KEYS_RE.exec(value);
  while (m) {
    const offset = m.index;
    if (offset > last) {
      parts.push({ type: 'text', value: value.slice(last, offset) });
    }
    const tokens = splitKbdTokens(m[1]!);
    if (!tokens.length) {
      parts.push({ type: 'text', value: m[0] });
    } else {
      const node: MnKbd = {
        type: 'kbd',
        keys: tokens.map((name) => ({
          name: name.toLowerCase().replace(/\s+/g, '-'),
          label: kbdKeyLabel(name),
        })),
      };
      parts.push(node);
    }
    last = offset + m[0].length;
    m = KEYS_RE.exec(value);
  }
  if (last < value.length) {
    parts.push({ type: 'text', value: value.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', value }];
};

const remarkKeys = (): ((tree: MnRoot) => void) => (tree) => {
  tree.children = mapTextNodes(tree.children, parseKeys);
};

export default remarkKeys;
