import { InlineCode } from '~/components/ui/inline-code';
import type { MnInlineCode } from '~/types/mdast';

const parserInlineCode = (mn: MnInlineCode) => (
  <InlineCode value={mn.value} />
);

export default parserInlineCode;
