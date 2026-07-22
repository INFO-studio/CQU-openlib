import type { MnHighlight } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserHighlight = (mn: MnHighlight) => (
  <mark className="rounded-[0.15em] bg-primary-soft px-[0.15em] py-[0.05em] text-ink">
    {mn.children?.map(parser)}
  </mark>
);
export default parserHighlight;
