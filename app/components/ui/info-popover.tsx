import { Popover } from '@base-ui/react/popover';
import { Info } from 'lucide-react';
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '~/lib/cn';

type Props = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
};

export const InfoPopover = ({ ariaLabel, children, className }: Props) => {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current === null) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openOnHover = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearCloseTimer();
    setOpen(true);
  };
  const closeAfterHover = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 100);
  };

  useEffect(() => clearCloseTimer, []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(
          'grid h-8 w-8 place-items-center rounded text-icon outline-none transition-colors hover:bg-mist hover:text-ink focus-visible:bg-mist focus-visible:text-ink data-[popup-open]:bg-mist data-[popup-open]:text-ink',
          className,
        )}
        onPointerEnter={openOnHover}
        onPointerLeave={closeAfterHover}
      >
        <Info size={16} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="z-[80] outline-none"
          sideOffset={6}
          align="end"
        >
          <Popover.Popup
            className="w-[min(20rem,calc(100vw-1.5rem))] origin-[var(--transform-origin)] rounded-md border border-line bg-elev p-4 text-sm text-ink shadow-[0_10px_30px_rgba(15,23,42,0.16)] outline-none"
            onPointerEnter={openOnHover}
            onPointerLeave={closeAfterHover}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
