import { CollapseGroup } from '~/components/ui/collapse-group';
import type { MnCollapseGroup } from '~/types/mdast';
import parser from '~/utils/parser/index';

const titleKey = (
  title: MnCollapseGroup['items'][number]['title'],
  index: number,
) => {
  const text = title
    .map((node) => (node.type === 'text' ? node.value : node.type))
    .join('');
  return `${text || 'collapse'}-${index}`;
};

const parserCollapseGroup = (mn: MnCollapseGroup) => (
  <CollapseGroup
    items={mn.items.map((item, index) => ({
      key: titleKey(item.title, index),
      title: <>{item.title.map(parser)}</>,
      children: <>{item.children.map(parser)}</>,
    }))}
  />
);

export default parserCollapseGroup;
