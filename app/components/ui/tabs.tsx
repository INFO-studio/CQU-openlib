import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '~/lib/cn';

export type TabsItem = {
  title: ReactNode;
  children: ReactNode;
  key?: string;
};

type Props = {
  items: TabsItem[];
  className?: string;
};

export const Tabs = ({ items, className }: Props) => {
  const [active, setActive] = useState(0);
  /** 0 until the reader switches, so panels do not animate on page load. */
  const [direction, setDirection] = useState(0);
  if (!items.length) return null;

  const select = (next: number) => {
    setDirection(next === active ? 0 : next > active ? 1 : -1);
    setActive(next);
  };
  const enterAnimation =
    direction === 0
      ? undefined
      : direction > 0
        ? 'animate-tab-in-right'
        : 'animate-tab-in-left';

  return (
    <div className={cn('cquol-tabs my-[0.65rem]', className)}>
      <div
        className="cquol-tabs__list mb-2 flex flex-wrap gap-[0.15rem] border-b border-line"
        role="tablist"
      >
        {items.map((item, i) => (
          <button
            key={item.key ?? `tab-${i}`}
            type="button"
            role="tab"
            className={cn(
              'cquol-tabs__tab -mb-px border-b-2 border-transparent bg-transparent px-[0.55rem] py-[0.35rem] text-sm text-muted',
              active === i && 'border-b-primary font-semibold text-ink',
            )}
            aria-selected={active === i}
            onClick={() => select(i)}
          >
            {item.title}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div
          key={`panel-${item.key ?? i}`}
          role="tabpanel"
          hidden={active !== i}
          className={cn(
            'cquol-tabs__panel motion-reduce:animate-none',
            active === i && enterAnimation,
          )}
        >
          {item.children}
        </div>
      ))}
    </div>
  );
};
