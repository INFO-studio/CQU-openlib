import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '~/lib/cn';

export type CollapseGroupItem = {
  title: ReactNode;
  children: ReactNode;
  key?: string;
};

type CollapseSize = 'default' | 'compact';

type CollapseItemProps = {
  item: CollapseGroupItem;
  divided: boolean;
  size: CollapseSize;
  onToggle?: (open: boolean) => void;
};

const CollapseItem = ({ item, divided, size, onToggle }: CollapseItemProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onToggle?.(next);
      }}
      className={cn(
        'cquol-collapse-group__item',
        divided && 'border-t border-line',
      )}
    >
      <Collapsible.Trigger
        className={cn(
          'flex w-full cursor-pointer select-none items-center text-left font-semibold text-ink transition-colors duration-150 hover:bg-mist',
          size === 'compact' ? 'gap-2 px-3 py-2 text-xs' : 'gap-2.5 px-4 py-3',
        )}
      >
        <span className="min-w-0 flex-1">{item.title}</span>
        <ChevronRight
          size={size === 'compact' ? 14 : 17}
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
        <div
          className={cn(
            'border-t border-line bg-paper [&>:first-child]:mt-0 [&>:last-child]:mb-0',
            size === 'compact' ? 'px-3 py-2' : 'px-4 py-3 pl-6',
          )}
        >
          {item.children}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};

type Props = {
  items: CollapseGroupItem[];
  className?: string;
  size?: CollapseSize;
  onToggle?: (index: number, open: boolean) => void;
};

export const CollapseGroup = ({
  items,
  className,
  size = 'default',
  onToggle,
}: Props) => {
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
          size={size}
          onToggle={onToggle ? (open) => onToggle(index, open) : undefined}
        />
      ))}
    </div>
  );
};
