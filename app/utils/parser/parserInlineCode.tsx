import type { MnInlineCode } from '~/types/mdast';

const parserInlineCode = (mn: MnInlineCode) => (
  <pre className={'inline'}>
    <code>{mn.value}</code>
  </pre>
);
export default parserInlineCode;
