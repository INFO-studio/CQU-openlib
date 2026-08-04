import { match } from 'ts-pattern';
import type { Mn } from '~/types/mdast';
import type {
  MnAdmonition,
  MnAdmonitionType,
} from '~/types/mdast/mnAdmonition';
import type { MnParagraph } from '~/types/mdast/mnParagraph';
import type { MnRoot } from '~/types/mdast/mnRoot';
import type { MnText } from '~/types/mdast/mnText';
import {
  ADMONITION_PATTERN,
  type AdmonitionCollapse,
  collapseFromMarker,
  isValidAdmonitionType,
} from '~/utils/admonition';
import {
  ADMONITION_END,
  ADMONITION_START,
} from '~/utils/preprocess/placeholders';

/**
 * A placeholder nested in a list item keeps whatever indent the list marker did
 * not consume, so compare on the trimmed value.
 */
const isMarker = (n: Mn, marker: string) =>
  n.type === 'html' && n.value?.trim() === marker;

const isStart = (n: Mn) => isMarker(n, ADMONITION_START);

const isEnd = (n: Mn) => isMarker(n, ADMONITION_END);

const HEAD_OPEN_QUOTE = /^(?:!!!|\?\?\?\+?)\s+\S+\s+"/;

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
  const match = firstText.value.match(HEAD_OPEN_QUOTE);
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
    // sit at `start`. A trailing link before the closer lands at `quoteEnd`
    // (closer is the next text char) — include `start === quoteEnd`, never after.
    const inTitle =
      child.type === 'text'
        ? end > quoteStart && start < quoteEnd
        : start >= quoteStart && start <= quoteEnd;
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
  meta: {
    type: MnAdmonitionType;
    title: Mn[];
    collapse?: AdmonitionCollapse;
  } | null;
};

const flushBroken = (pre: RemarkAdmonitionState) => {
  // Failed / incomplete admonition must not swallow the rest of the document.
  if (pre.meta) {
    pre.out.push({
      type: 'admonition',
      admonitionType: pre.meta.type,
      title: extractTitle(pre.meta.title),
      children: pre.buffer ?? [],
      ...(pre.meta.collapse ? { collapse: pre.meta.collapse } : {}),
    } satisfies MnAdmonition);
  } else if (pre.buffer?.length) {
    pre.out.push(...pre.buffer);
  }
  pre.buffer = null;
  pre.meta = null;
};

const convertAdmonitions = (nodes: Mn[]): Mn[] => {
  const pre = nodes.reduce<RemarkAdmonitionState>(
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

            const marker = matchResult?.[1] ?? '';
            const typeRaw = matchResult?.[2]?.toLowerCase() ?? '';
            if (matchResult && isValidAdmonitionType(typeRaw)) {
              const collapse = collapseFromMarker(marker);
              pre.meta = {
                type: typeRaw as MnAdmonitionType,
                title: (cur as MnParagraph).children ?? [],
                ...(collapse ? { collapse } : {}),
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
  return pre.out;
};

/**
 * Material allows an admonition inside a list item, where the fold above never
 * looked — `tabs` hides its content in `items[]` for the same reason.
 */
const descend = (nodes: Mn[]): Mn[] =>
  convertAdmonitions(nodes).map((node) => {
    if (node.type === 'tabs' || node.type === 'collapseGroup') {
      for (const item of node.items) {
        item.children = descend(item.children);
      }
      return node;
    }
    if ('children' in node && node.children) {
      (node as { children: Mn[] }).children = descend(node.children as Mn[]);
    }
    return node;
  });

const remarkAdmonition = () => {
  return (tree: MnRoot) => {
    tree.children = descend(tree.children ?? []);
  };
};

export default remarkAdmonition;
