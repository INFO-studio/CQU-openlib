import type { MnListItem } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserListItem = (mn: MnListItem) => <li>{mn.children.map(parser)}</li>;
export default parserListItem;
