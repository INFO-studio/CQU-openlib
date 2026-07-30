import { Blockquote } from '~/components/ui/blockquote';
import type { MnBlockquote } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserBlockquote = (mn: MnBlockquote) => (
  <Blockquote>{mn.children.map(parser)}</Blockquote>
);

export default parserBlockquote;
