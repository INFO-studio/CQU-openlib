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

const parserHeading = (mn: MnHeading) => {
  const level = Math.min(Math.max(mn.depth ?? 1, 1), 6) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;
  const text = textFromChildren(mn.children);
  const id = slugify(text) || undefined;
  const children = mn.children?.map(parser);
  const className = H_CLASS[level];
  const props = { id, children, className };

  switch (level) {
    case 1:
      return <h1 {...props} />;
    case 2:
      return <h2 {...props} />;
    case 3:
      return <h3 {...props} />;
    case 4:
      return <h4 {...props} />;
    case 5:
      return <h5 {...props} />;
    default:
      return <h6 {...props} />;
  }
};

export default parserHeading;
