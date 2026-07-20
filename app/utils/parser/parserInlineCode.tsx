import type { MnInlineCode } from '~/types/mdast';

const parserInlineCode = (mn: MnInlineCode) => <code>{mn.value}</code>;
export default parserInlineCode;
