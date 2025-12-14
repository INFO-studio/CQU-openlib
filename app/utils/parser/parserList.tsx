import { match } from 'ts-pattern';
import type { MnList } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserList = (mn: MnList) =>
  match(mn)
    .with({ ordered: true }, () => <ol>{mn.children.map(parser)}</ol>)
    .with({ ordered: false }, () => <ul>{mn.children.map(parser)}</ul>)
    .exhaustive();
export default parserList;
