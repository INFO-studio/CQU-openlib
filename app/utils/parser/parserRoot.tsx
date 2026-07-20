import type { MnRoot } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserRoot = (mn: MnRoot) => (
  <div className="docs-prose">{mn.children?.map(parser)}</div>
);

export default parserRoot;
