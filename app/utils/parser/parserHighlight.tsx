import type { MnHighlight } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserHighlight = (mn: MnHighlight) => (
  <mark>{mn.children?.map(parser)}</mark>
);
export default parserHighlight;
