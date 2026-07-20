import type { MnEmphasis } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserEmphasis = (mn: MnEmphasis) => <em>{mn.children.map(parser)}</em>;

export default parserEmphasis;
