import { createElement, type ReactElement } from 'react';
import type { MnHeading } from '~/types/mdast';
import { slugify, textFromChildren } from '~/utils/headingText';
import parser from '~/utils/parser/index';

const H_CLASS = {
  1: 'm-0 mb-2 font-display text-[1.75rem] font-semibold leading-[1.25] tracking-[-0.02em]',
  2: 'mt-[1.35rem] mb-[0.4rem] font-display text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.015em]',
  3: 'mt-4 mb-[0.3rem] font-display text-[1.05rem] font-semibold leading-[1.35]',
  4: 'mt-[0.85rem] mb-1 font-display text-[0.95rem] font-semibold',
  5: 'mt-[0.85rem] mb-1 font-display text-[0.95rem] font-semibold',
  6: 'mt-[0.85rem] mb-1 font-display text-[0.95rem] font-semibold',
} as const;

const parserHeading = (mn: MnHeading): ReactElement => {
  const level = Math.min(Math.max(mn.depth ?? 1, 1), 6) as MnHeading['depth'];
  const id = (mn.id ?? slugify(textFromChildren(mn.children))) || undefined;
  return createElement(
    `h${level}`,
    { id, className: H_CLASS[level] },
    mn.children?.map(parser),
  );
};

export default parserHeading;
