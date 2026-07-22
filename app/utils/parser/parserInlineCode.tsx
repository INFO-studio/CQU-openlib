import type { MnInlineCode } from '~/types/mdast';

const parserInlineCode = (mn: MnInlineCode) => (
  <code className="rounded-[0.2em] bg-code-bg px-[0.3em] py-[0.05em] font-mono text-[0.875em] text-ink">
    {mn.value}
  </code>
);
export default parserInlineCode;
