import type { MnHeading } from '~/types/mdast';
import { slugify, textFromChildren } from '~/utils/headingText';
import parser from '~/utils/parser/index';

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
  const props = { id, children };

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
