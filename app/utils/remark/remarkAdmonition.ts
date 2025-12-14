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
    if ((end > quoteStart && start < quoteEnd) || child.type !== 'text') {
      titleNodes.push(child);
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

const remarkAdmonition = () => {
  return (tree: MnRoot) => {
    const pre = (tree.children ?? []).reduce<RemarkAdmonitionState>(
      (pre, cur) =>
        match({ pre, cur })
          .when(
            ({ cur }) => isStart(cur),
            ({ pre }) => {
              pre.buffer = [];
              pre.meta = null;
              return pre;
            },
          )
          .when(
            ({ pre, cur }) => isEnd(cur) && pre.buffer && pre.meta,
            ({ pre }) => {
              pre.out.push({
                type: 'admonition',
                admonitionType: pre.meta?.type ?? 'info',
                title: extractTitle(pre.meta?.title),
                children: pre.buffer ?? [],
              } satisfies MnAdmonition);
              pre.buffer = null;
              pre.meta = null;
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

              if (matchResult && isValidAdmonitionType(matchResult[1])) {
                pre.meta = {
                  type: matchResult[1] as MnAdmonitionType,
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

    tree.children = pre.out;
  };
};

export default remarkAdmonition;
