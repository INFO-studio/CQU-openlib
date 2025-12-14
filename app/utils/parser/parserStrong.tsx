import type { MnStrong } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserStrong = (mn: MnStrong) => (
  <strong>{mn.children.map(parser)}</strong>
);
export default parserStrong;
