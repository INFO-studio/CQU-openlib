import type { MnParagraph } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserParagraph = (mn: MnParagraph) => <p>{mn.children?.map(parser)}</p>;
export default parserParagraph;
