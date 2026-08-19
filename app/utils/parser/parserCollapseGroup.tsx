import { CollapseGroup } from '~/components/ui/collapse-group';
import { trackItemClick } from '~/lib/analytics';
import type { MnCollapseGroup } from '~/types/mdast';
import { mdastText } from '~/utils/mdastText';
import parser from '~/utils/parser/index';

const titleKey = (
  title: MnCollapseGroup['items'][number]['title'],
  index: number,
) => `${mdastText(title) || 'collapse'}-${index}`;

const parserCollapseGroup = (mn: MnCollapseGroup) => (
  <CollapseGroup
    items={mn.items.map((item, index) => ({
      key: titleKey(item.title, index),
      title: <>{item.title.map(parser)}</>,
      children: <>{item.children.map(parser)}</>,
    }))}
    onToggle={(index, open) =>
      trackItemClick({
        item_type: 'collapse',
        variant: 'group',
        title: mdastText(mn.items[index]?.title) || `collapse-${index}`,
        open,
      })
    }
  />
);

export default parserCollapseGroup;
