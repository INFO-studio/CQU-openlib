import { useState } from 'react';
import type { MnTabs } from '~/types/mdast';
import parser from '~/utils/parser/index';

const titleKey = (title: MnTabs['items'][number]['title'], index: number) => {
  const text = title
    .map((n) => (n.type === 'text' ? (n.value ?? '') : n.type))
    .join('');
  return `${text || 'tab'}-${index}`;
};
const TabsView = ({ mn }: { mn: MnTabs }) => {
  const [active, setActive] = useState(0);
  const items = mn.items ?? [];
  if (!items.length) return null;
  return (
    <div className="docs-tabs">
      <div className="docs-tabs__list" role="tablist">
        {items.map((item, i) => (
          <button
            key={titleKey(item.title, i)}
            type="button"
            role="tab"
            className="docs-tabs__tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
          >
            {item.title.map(parser)}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div
          key={`panel-${titleKey(item.title, i)}`}
          className="docs-tabs__panel"
          role="tabpanel"
          hidden={active !== i}
        >
          {item.children.map(parser)}
        </div>
      ))}
    </div>
  );
};
const parserTabs = (mn: MnTabs) => <TabsView mn={mn} />;
export default parserTabs;
