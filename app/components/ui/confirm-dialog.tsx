import { AlertDialog } from '@base-ui/react/alert-dialog';
import { type ReactNode, useState } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerDisabled?: boolean;
  title: string;
  description?: ReactNode;
  /** Extra body, e.g. a field the action needs. */
  children?: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  confirmDisabled?: boolean;
  /** Resolve `true` to close; `false` keeps the dialog open to show an error. */
  onConfirm: () => Promise<boolean> | boolean;
  onOpenChange?: (open: boolean) => void;
  /** Portals render under `<body>`; pass `theme-dark` from dark-pinned islands. */
  className?: string;
};

const BUTTON =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-[0.84rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const ConfirmDialog = ({
  trigger,
  triggerClassName,
  triggerDisabled,
  title,
  description,
  children,
  confirmLabel,
  tone = 'default',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onOpenChange,
  className,
}: Props) => {
  const [open, setOpen] = useState(false);

  const change = (next: boolean) => {
    if (busy && !next) return;
    setOpen(next);
    onOpenChange?.(next);
  };

  const confirm = async () => {
    if (await onConfirm()) change(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={change}>
      <AlertDialog.Trigger
        className={triggerClassName}
        disabled={triggerDisabled}
      >
        {trigger}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-60 bg-backdrop" />
        <AlertDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-61 grid w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-line bg-panel p-5 text-ink shadow-2xl outline-none',
            className,
          )}
        >
          <div className="grid gap-1.5">
            <AlertDialog.Title className="m-0 text-base font-semibold">
              {title}
            </AlertDialog.Title>
            {description ? (
              <AlertDialog.Description className="m-0 text-[0.84rem] leading-relaxed text-muted">
                {description}
              </AlertDialog.Description>
            ) : null}
          </div>
          {children}
          <div className="flex justify-end gap-2">
            <AlertDialog.Close
              disabled={busy}
              className={cn(BUTTON, 'text-muted hover:bg-mist hover:text-ink')}
            >
              取消
            </AlertDialog.Close>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy || confirmDisabled}
              className={cn(
                BUTTON,
                'font-medium text-paper',
                tone === 'danger'
                  ? 'bg-error hover:opacity-90'
                  : 'bg-primary hover:bg-primary-hover',
              )}
            >
              {busy ? '处理中…' : confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
