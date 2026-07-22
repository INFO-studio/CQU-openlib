import { Fragment, type ReactNode } from 'react';
import type { Mn } from '~/types/mdast';

const isHtml = (n: Mn): n is Mn & { type: 'html'; value: string } =>
  n.type === 'html';

export const isHomePairOpen = (n: Mn) =>
  isHtml(n) && /^\s*<div\b[^>]*\bdocs-home-pair\b[^>]*>\s*$/i.test(n.value);

export const isHomePairClose = (n: Mn) =>
  isHtml(n) && /^\s*<\/div>\s*$/i.test(n.value);

/**
 * Walk mdast children, wrapping explicit
 * `<div class="docs-home-pair">…</div>` regions into one React node.
 */
export const mapDocNodes = (
  nodes: Mn[],
  render: (node: Mn, index: number) => ReactNode,
): ReactNode[] => {
  const out: ReactNode[] = [];
  for (let i = 0; i < nodes.length; ) {
    const cur = nodes[i]!;
    if (isHomePairOpen(cur)) {
      const start = i;
      i += 1;
      const inner: ReactNode[] = [];
      while (i < nodes.length && !isHomePairClose(nodes[i]!)) {
        inner.push(<Fragment key={i}>{render(nodes[i]!, i)}</Fragment>);
        i += 1;
      }
      if (i < nodes.length && isHomePairClose(nodes[i]!)) i += 1;
      out.push(
        <div key={`home-pair-${start}`} className="docs-home-pair">
          {inner}
        </div>,
      );
      continue;
    }
    out.push(<Fragment key={i}>{render(cur, i)}</Fragment>);
    i += 1;
  }
  return out;
};
