import { match } from 'ts-pattern';
import type { MnList } from '~/types/mdast';
import parser from '~/utils/parser/index';

const listBase =
  'my-1 pl-5 [&>li]:my-[0.15rem] [&>li>ul]:my-[0.15rem] [&>li>ul]:mb-1 [&>li>ol]:my-[0.15rem] [&>li>ol]:mb-1 [&>li::marker]:text-muted';

const parserList = (mn: MnList) =>
  match(mn)
    .with({ ordered: true }, () => (
      <ol className={`${listBase} list-decimal`}>{mn.children.map(parser)}</ol>
    ))
    .with({ ordered: false }, () => (
      <ul
        className={`${listBase} list-disc [&_ul]:list-circle [&_ul_ul]:list-square`}
      >
        {mn.children.map(parser)}
      </ul>
    ))
    .exhaustive();

export default parserList;
