import { Mark } from '~/components/ui/mark';
import type { MnHighlight } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserHighlight = (mn: MnHighlight) => (
  <Mark>{mn.children?.map(parser)}</Mark>
);

export default parserHighlight;
