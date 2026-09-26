import { kbdKeyLabel, splitKbdTokens } from '~/lib/kbdKeys';
import type { Mn, MnRoot } from '~/types/mdast';
import { mapTextNodes } from '~/utils/remark/mapTextNodes';
import { splitByPattern } from '~/utils/splitByPattern';

const KEYS_RE =
  /\+\+((?:[A-Za-z0-9_.-]+|"[^"]+"|'[^']+')(?:\+(?:[A-Za-z0-9_.-]+|"[^"]+"|'[^']+'))*)\+\+/;

const parseKeys = (value: string): Mn[] =>
  splitByPattern(value, KEYS_RE).map((part): Mn => {
    const matched = part.match(KEYS_RE);
    if (!matched) return { type: 'text', value: part };
    const tokens = splitKbdTokens(matched[1]!);
    return tokens.length
      ? {
          type: 'kbd',
          keys: tokens.map((name) => ({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            label: kbdKeyLabel(name),
          })),
        }
      : { type: 'text', value: part };
  });

const remarkKeys = () => (tree: MnRoot) => {
  tree.children = mapTextNodes(tree.children, parseKeys);
};

export default remarkKeys;
