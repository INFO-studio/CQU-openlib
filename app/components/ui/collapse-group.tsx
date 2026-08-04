import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '~/lib/cn';

export type CollapseGroupItem = {
  title: ReactNode;
  children: ReactNode;
  key?: string;
};

type CollapseItemProps = {
  item: CollapseGroupItem;
  divided: boolean;
};

const CollapseItem = ({ item, divided }: CollapseItemProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'cquol-collapse-group__item',
        divided && 'border-t border-line',
      )}
    >
      <Collapsible.Trigger className="flex w-full cursor-pointer select-none items-center gap-2.5 px-4 py-3 text-left font-semibold text-ink transition-colors duration-150 hover:bg-mist">
        <span className="min-w-0 flex-1">{item.title}</span>
        <ChevronRight
          size={17}
          className={cn(
            'shrink-0 text-icon transition-transform duration-150',
            open && 'rotate-90 text-icon-strong',
          )}
          aria-hidden
        />
      </Collapsible.Trigger>
      <Collapsible.Panel
        hiddenUntilFound
        className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none"
      >
        <div className="border-t border-line bg-paper px-4 py-3 pl-6 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {item.children}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};

type Props = {
  items: CollapseGroupItem[];
  className?: string;
};

export const CollapseGroup = ({ items, className }: Props) => {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        'cquol-collapse-group my-[0.65rem] overflow-hidden rounded-md border border-line bg-panel',
        className,
      )}
    >
      {items.map((item, index) => (
        <CollapseItem
          key={item.key ?? `collapse-${index}`}
          item={item}
          divided={index > 0}
        />
      ))}
    </div>
  );
};
