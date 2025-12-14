import type { MnLink } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserLink = (mn: MnLink) => (
  <a href={mn.url || ''}>{mn.children.map(parser)}</a>
);
export default parserLink;
