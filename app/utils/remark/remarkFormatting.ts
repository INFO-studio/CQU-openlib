import { match } from 'ts-pattern';
import type { Mn, MnRoot } from '~/types/mdast';
import { mapTextNodes } from '~/utils/remark/mapTextNodes';
import { splitByPattern } from '~/utils/splitByPattern';

const MARKER_RE = /({==.*?==})|({!!.*?!!})|({--.*?--})/s;

const parseFormatting = (value: string): Mn[] =>
  splitByPattern(value, MARKER_RE).map((part): Mn => {
    if (!MARKER_RE.test(part)) return { type: 'text', value: part };
    const children = parseFormatting(part.slice(3, -3));
    return match(part.slice(0, 3))
      .with('{==', () => ({ type: 'highlight', children }) as const)
      .with(
        '{!!',
        () => ({ type: 'highlight', tone: 'danger', children }) as const,
      )
      .otherwise(() => ({ type: 'strikethrough', children }) as const);
  });

const remarkFormatting = () => (tree: MnRoot) => {
  tree.children = mapTextNodes(tree.children, parseFormatting);
};

export default remarkFormatting;
