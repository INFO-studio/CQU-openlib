import { Tabs } from '~/components/ui/tabs';
import type { MnTabs } from '~/types/mdast';
import { mdastText } from '~/utils/mdastText';
import parser from '~/utils/parser/index';

const titleKey = (title: MnTabs['items'][number]['title'], index: number) =>
  `${mdastText(title) || 'tab'}-${index}`;

const parserTabs = (mn: MnTabs) => {
  const items = (mn.items ?? []).map((item, i) => ({
    key: titleKey(item.title, i),
    title: <>{item.title.map(parser)}</>,
    children: <>{item.children.map(parser)}</>,
  }));
  return <Tabs items={items} />;
};

export default parserTabs;
