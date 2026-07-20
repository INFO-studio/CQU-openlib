import { useEffect, useState } from 'react';
import { cn } from '~/lib/cn';
import type { TocItem } from '~/utils/toc';

type Props = {
  items: TocItem[];
};

export type { TocItem };

/** Sticky header offset used when deciding which heading is “current”. */
const SPY_OFFSET_PX = 96;

const Toc = ({ items }: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!items.length) {
      setActiveId(null);
      return;
    }

    const update = () => {
      let current: string | null = items[0]?.id ?? null;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= SPY_OFFSET_PX) {
          current = item.id;
        } else {
          break;
        }
      }
      setActiveId(current);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [items]);

  if (!items.length) return null;

  return (
    <nav aria-label="本页目录" className="docs-nav flex flex-col gap-1.5">
      <p className="text-[0.7rem] font-semibold tracking-wide text-muted">
        本页
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active ? 'location' : undefined}
                className={cn(
                  'block border-l-2 py-0.5 text-[0.8125rem] no-underline transition-colors',
                  active
                    ? 'border-primary font-medium text-ink'
                    : 'border-transparent text-muted hover:text-ink',
                )}
                style={{
                  paddingLeft: `${0.55 + (item.level - 2) * 0.55}rem`,
                }}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
export default Toc;
