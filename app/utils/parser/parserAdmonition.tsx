import type { MnAdmonition } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserAdmonition = (mn: MnAdmonition) => (
  <div className={`admonition bg-pink admonition-${mn.admonitionType}`}>
    {mn.title && <p className="admonition-title">{mn.title?.map(parser)}</p>}
    <div className="admonition-content">{mn.children?.map(parser)}</div>
  </div>
);

export default parserAdmonition;
