import type { MnBlockquote } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserBlockquote = (mn: MnBlockquote) => (
  <blockquote className="my-[0.6rem] border-l-2 border-l-primary-soft pl-[0.85rem] text-muted">
    {mn.children.map(parser)}
  </blockquote>
);

export default parserBlockquote;
