import type { ReactNode } from 'react';
import { match } from 'ts-pattern';
import type { Mn } from '~/types/mdast';
import parserAdmonition from '~/utils/parser/parserAdmonition';
import parserBreak from '~/utils/parser/parserBreak';
import parserHeading from '~/utils/parser/parserHeading';
import parserHighlight from '~/utils/parser/parserHighlight';
import parserHtml from '~/utils/parser/parserHtml';
import parserIcon from '~/utils/parser/parserIcon';
import parserInlineCode from '~/utils/parser/parserInlineCode';
import parserLink from '~/utils/parser/parserLink';
import parserList from '~/utils/parser/parserList';
import parserListItem from '~/utils/parser/parserListItem';
import parserParagraph from '~/utils/parser/parserParagraph';
import parserRoot from '~/utils/parser/parserRoot';
import parserStrikethrough from '~/utils/parser/parserStrikethrough';
import parserStrong from '~/utils/parser/parserStrong';
import parserText from '~/utils/parser/parserText';
import parserThematicBreak from '~/utils/parser/parserThematicBreak';
import parserYaml from '~/utils/parser/parserYaml';

const parser = (mn: Mn) =>
  match<Mn, ReactNode>(mn)
    .with({ type: 'admonition' }, parserAdmonition)
    .with({ type: 'highlight' }, parserHighlight)
    .with({ type: 'html' }, parserHtml)
    .with({ type: 'paragraph' }, parserParagraph)
    .with({ type: 'root' }, parserRoot)
    .with({ type: 'strikethrough' }, parserStrikethrough)
    .with({ type: 'text' }, parserText)
    .with({ type: 'thematicBreak' }, parserThematicBreak)
    .with({ type: 'list' }, parserList)
    .with({ type: 'listItem' }, parserListItem)
    .with({ type: 'heading' }, parserHeading)
    .with({ type: 'link' }, parserLink)
    .with({ type: 'inlineCode' }, parserInlineCode)
    .with({ type: 'strong' }, parserStrong)
    .with({ type: 'yaml' }, parserYaml)
    .with({ type: 'icon' }, parserIcon)
    .with({ type: 'break' }, parserBreak)
    .otherwise(() => (
      <div className={'bg-red text-white'}>{`unknown node: ${mn.type}`}</div>
    ));

export default parser;
