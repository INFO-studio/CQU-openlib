import { Tabs } from '~/components/ui/tabs';
import type { MnTabs } from '~/types/mdast';
import parser from '~/utils/parser/index';

const titleKey = (title: MnTabs['items'][number]['title'], index: number) => {
  const text = title
    .map((n) => (n.type === 'text' ? (n.value ?? '') : n.type))
    .join('');
  return `${text || 'tab'}-${index}`;
};

const parserTabs = (mn: MnTabs) => {
  const items = (mn.items ?? []).map((item, i) => ({
    key: titleKey(item.title, i),
    title: <>{item.title.map(parser)}</>,
    children: <>{item.children.map(parser)}</>,
  }));
  return <Tabs items={items} />;
};

export default parserTabs;
