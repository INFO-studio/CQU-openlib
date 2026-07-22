import type { ReactNode } from 'react';
import { match } from 'ts-pattern';
import type { Mn } from '~/types/mdast';
import parserAdmonition from '~/utils/parser/parserAdmonition';
import parserBlockquote from '~/utils/parser/parserBlockquote';
import parserBreak from '~/utils/parser/parserBreak';
import parserCode from '~/utils/parser/parserCode';
import parserDelete from '~/utils/parser/parserDelete';
import parserEmphasis from '~/utils/parser/parserEmphasis';
import {
  parserFootnoteDefinition,
  parserFootnoteReference,
} from '~/utils/parser/parserFootnote';
import parserHeading from '~/utils/parser/parserHeading';
import parserHighlight from '~/utils/parser/parserHighlight';
import parserHtml from '~/utils/parser/parserHtml';
import parserIcon from '~/utils/parser/parserIcon';
import parserImage from '~/utils/parser/parserImage';
import parserInlineCode from '~/utils/parser/parserInlineCode';
import parserKbd from '~/utils/parser/parserKbd';
import parserLink from '~/utils/parser/parserLink';
import parserList from '~/utils/parser/parserList';
import parserListItem from '~/utils/parser/parserListItem';
import parserParagraph from '~/utils/parser/parserParagraph';
import parserRoot from '~/utils/parser/parserRoot';
import parserStrikethrough from '~/utils/parser/parserStrikethrough';
import parserStrong from '~/utils/parser/parserStrong';
import parserTable from '~/utils/parser/parserTable';
import parserTabs from '~/utils/parser/parserTabs';
import parserText from '~/utils/parser/parserText';
import parserThematicBreak from '~/utils/parser/parserThematicBreak';
import parserYaml from '~/utils/parser/parserYaml';

const parser = (mn: Mn) =>
  match<Mn, ReactNode>(mn)
    .with({ type: 'admonition' }, parserAdmonition)
    .with({ type: 'blockquote' }, parserBlockquote)
    .with({ type: 'break' }, parserBreak)
    .with({ type: 'code' }, parserCode)
    .with({ type: 'delete' }, parserDelete)
    .with({ type: 'emphasis' }, parserEmphasis)
    .with({ type: 'footnoteDefinition' }, parserFootnoteDefinition)
    .with({ type: 'footnoteReference' }, parserFootnoteReference)
    .with({ type: 'heading' }, parserHeading)
    .with({ type: 'highlight' }, parserHighlight)
    .with({ type: 'html' }, parserHtml)
    .with({ type: 'icon' }, parserIcon)
    .with({ type: 'image' }, parserImage)
    .with({ type: 'inlineCode' }, parserInlineCode)
    .with({ type: 'kbd' }, parserKbd)
    .with({ type: 'link' }, parserLink)
    .with({ type: 'list' }, parserList)
    .with({ type: 'listItem' }, parserListItem)
    .with({ type: 'paragraph' }, parserParagraph)
    .with({ type: 'root' }, parserRoot)
    .with({ type: 'strikethrough' }, parserStrikethrough)
    .with({ type: 'strong' }, parserStrong)
    .with({ type: 'table' }, parserTable)
    .with({ type: 'tabs' }, parserTabs)
    .with({ type: 'text' }, parserText)
    .with({ type: 'thematicBreak' }, parserThematicBreak)
    .with({ type: 'yaml' }, parserYaml)
    .otherwise(() => (
      <div className="rounded bg-accent px-2 py-1 text-sm text-paper">{`unknown node: ${mn.type}`}</div>
    ));

export default parser;
