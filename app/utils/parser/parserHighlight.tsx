import type { MnHighlight } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserHighlight = (mn: MnHighlight) => (
  <mark className="docs-highlight">{mn.children?.map(parser)}</mark>
);
export default parserHighlight;
