import { useState } from 'react';
import { cn } from '~/lib/cn';
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
    <div className="my-[0.65rem]">
      <div
        className="mb-2 flex flex-wrap gap-[0.15rem] border-b border-line"
        role="tablist"
      >
        {items.map((item, i) => (
          <button
            key={titleKey(item.title, i)}
            type="button"
            role="tab"
            className={cn(
              '-mb-px border-b-2 border-transparent bg-transparent px-[0.55rem] py-[0.35rem] text-sm text-muted',
              active === i && 'border-b-primary font-semibold text-ink',
            )}
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
