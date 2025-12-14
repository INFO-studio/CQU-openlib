import type { MnStrikethrough } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserStrikethrough = (mn: MnStrikethrough) => (
  <del>{mn.children?.map(parser)}</del>
);
export default parserStrikethrough;
