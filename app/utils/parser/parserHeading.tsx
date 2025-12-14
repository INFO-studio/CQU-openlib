import { match } from 'ts-pattern';
import type { MnHeading } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserHeading = (mn: MnHeading) =>
  match(mn)
    .with({ depth: 1 }, (mn) => <h1>{mn.children.map(parser)}</h1>)
    .with({ depth: 2 }, (mn) => <h2>{mn.children.map(parser)}</h2>)
    .with({ depth: 3 }, (mn) => <h3>{mn.children.map(parser)}</h3>)
    .with({ depth: 4 }, (mn) => <h4>{mn.children.map(parser)}</h4>)
    .with({ depth: 5 }, (mn) => <h5>{mn.children.map(parser)}</h5>)
    .with({ depth: 6 }, (mn) => <h6>{mn.children.map(parser)}</h6>)
    .exhaustive();
export default parserHeading;
