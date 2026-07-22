import type { MnParagraph } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserParagraph = (mn: MnParagraph) => (
  <p className="my-[0.35rem]">{mn.children?.map(parser)}</p>
);

export default parserParagraph;
