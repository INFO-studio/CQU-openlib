import type { MnDelete } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserDelete = (mn: MnDelete) => (
  <del className="docs-strike">{mn.children.map(parser)}</del>
);

export default parserDelete;
