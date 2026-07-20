import { match } from 'ts-pattern';
import { ADMONITION_PATTERN } from '~/consts/admonition';
import { ADMONITION_END, ADMONITION_START } from '~/consts/placeholders';
import type { Mn } from '~/types/mdast';
import {
  isValidAdmonitionType,
  type MnAdmonition,
  type MnAdmonitionType,
} from '~/types/mdast/mnAdmonition';
import type { MnParagraph } from '~/types/mdast/mnParagraph';
import type { MnRoot } from '~/types/mdast/mnRoot';
import type { MnText } from '~/types/mdast/mnText';

const isStart = (n: Mn) => n.type === 'html' && n.value === ADMONITION_START;

const isEnd = (n: Mn) => n.type === 'html' && n.value === ADMONITION_END;

const inlineToText = (curs: Mn[]): string =>
  curs
    .map((n) =>
      n.type === 'text'
        ? (n.value ?? '')
        : n.type === 'link'
          ? inlineToText(n.children ?? [])
          : n.type === 'inlineCode'
            ? (n.value ?? '')
            : '',
    )
    .join('');

export const extractTitle = (children?: Mn[]): Mn[] => {
  if (!children || !children.length) return [];
  let charCount = 0;
  let quoteStart = -1;
  let quoteEnd = -1;
  const titleNodes: Mn[] = [];
  const firstText = children.find((c) => c.type === 'text') as
    | MnText
    | undefined;
  if (!firstText || !firstText.value) return [];
  const match = firstText.value.match(/^!!!\s+\S+\s+"/);
  if (match) {
    quoteStart = match[0].length;
  } else {
    return [];
  }
  const fullText = children
    .map((c) => (c.type === 'text' ? (c.value ?? '') : ''))
    .join('');
  quoteEnd = fullText.lastIndexOf('"');
  if (quoteStart >= quoteEnd) return [];
  children.forEach((child) => {
    const nodeText = child.type === 'text' ? (child.value ?? '') : '';
    const start = charCount;
    const end = charCount + nodeText.length;
    // Text: overlap (quoteStart, quoteEnd). Zero-width nodes (icon/link/break)
    // sit at `start` — include when inside the quotes, never after the closer.
    const inTitle =
      child.type === 'text'
        ? end > quoteStart && start < quoteEnd
        : start >= quoteStart && start < quoteEnd;
    // Clone so trimming quotes never mutates the source AST.
    if (inTitle) {
      titleNodes.push(child.type === 'text' ? { ...child } : child);
    }
    charCount = end;
  });
  if (titleNodes.length) {
    const first = titleNodes[0];
    if (first.type === 'text')
      first.value = first.value?.slice(quoteStart) ?? '';
    const last = titleNodes[titleNodes.length - 1];
    if (last.type === 'text') {
      const lastQuote = last.value?.lastIndexOf('"') ?? -1;
      if (lastQuote >= 0) last.value = last.value?.slice(0, lastQuote) ?? '';
    }
  }

  return titleNodes;
};

type RemarkAdmonitionState = {
  out: Mn[];
  buffer: Mn[] | null;
  meta: { type: MnAdmonitionType; title: Mn[] } | null;
};

const flushBroken = (pre: RemarkAdmonitionState) => {
  // Failed / incomplete admonition must not swallow the rest of the document.
  if (pre.meta) {
    pre.out.push({
      type: 'admonition',
      admonitionType: pre.meta.type,
      title: extractTitle(pre.meta.title),
      children: pre.buffer ?? [],
    } satisfies MnAdmonition);
  } else if (pre.buffer?.length) {
    pre.out.push(...pre.buffer);
  }
  pre.buffer = null;
  pre.meta = null;
};

const remarkAdmonition = () => {
  return (tree: MnRoot) => {
    const pre = (tree.children ?? []).reduce<RemarkAdmonitionState>(
      (pre, cur) =>
        match({ pre, cur })
          .when(
            ({ cur }) => isStart(cur),
            ({ pre }) => {
              if (pre.buffer) flushBroken(pre);
              pre.buffer = [];
              pre.meta = null;
              return pre;
            },
          )
          .when(
            ({ pre, cur }) => isEnd(cur) && !!pre.buffer,
            ({ pre }) => {
              flushBroken(pre);
              return pre;
            },
          )
          .when(
            ({ pre, cur }) =>
              !!pre.buffer &&
              !pre.meta &&
              cur.type === 'paragraph' &&
              cur.children,
            ({ pre, cur }) => {
              const matchResult = inlineToText(
                (cur as MnParagraph).children ?? [],
              ).match(ADMONITION_PATTERN);

              const typeRaw = matchResult?.[1]?.toLowerCase() ?? '';
              if (matchResult && isValidAdmonitionType(typeRaw)) {
                pre.meta = {
                  type: typeRaw as MnAdmonitionType,
                  title: (cur as MnParagraph).children ?? [],
                };
                return pre;
              }

              pre.buffer?.push(cur);
              return pre;
            },
          )
          .when(
            ({ pre }) => !!pre.buffer,
            ({ pre, cur }) => {
              pre.buffer?.push(cur);
              return pre;
            },
          )
          .otherwise(({ pre, cur }) => {
            pre.out.push(cur);
            return pre;
          }),
      {
        out: [],
        buffer: null,
        meta: null,
      },
    );

    if (pre.buffer) flushBroken(pre);
    tree.children = pre.out;
  };
};

export default remarkAdmonition;
