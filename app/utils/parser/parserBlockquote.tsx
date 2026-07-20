import type { MnBlockquote } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserBlockquote = (mn: MnBlockquote) => (
  <blockquote className="docs-blockquote">{mn.children.map(parser)}</blockquote>
);

export default parserBlockquote;
