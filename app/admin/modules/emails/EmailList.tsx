import { AlertTriangle } from 'lucide-react';
import { counterpart, type EmailSummary } from '~/admin/lib/emails';
import { formatShanghaiShort } from '~/admin/lib/time';
import { cn } from '~/lib/cn';

type Props = {
  items: EmailSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/**
 * Direction is carried by the layout itself: inbound sits flush against a solid
 * spine in full ink, outbound steps in and lightens. No badges needed to tell
 * who is talking.
 */
export const EmailList = ({ items, selectedId, onSelect }: Props) => (
  <ul className="m-0 grid list-none gap-1 p-0">
    {items.map((item) => {
      const inbound = item.direction === 'inbound';
      const selected = item.id === selectedId;
      return (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 rounded-r-lg border-l-[3px] py-2.5 pr-3 text-left transition-colors',
              inbound ? 'border-l-primary pl-3' : 'border-l-transparent pl-7',
              selected ? 'bg-elev' : 'hover:bg-mist',
            )}
          >
            <span className="sr-only">{inbound ? '收到' : '发出'}</span>
            <span
              className={cn(
                'min-w-0 truncate font-display text-[0.95rem] leading-snug',
                inbound ? 'font-semibold text-ink' : 'font-normal text-muted',
              )}
            >
              {item.subject || '(无主题)'}
            </span>
            <span className="shrink-0 font-mono text-[0.72rem] tabular-nums text-icon">
              {formatShanghaiShort(item.createdAt)}
            </span>
            <span className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-1.5">
              <span className="truncate font-mono text-[0.72rem] text-icon">
                {counterpart(item)}
              </span>
              <span className="truncate text-[0.78rem] text-muted">
                {item.preview}
              </span>
            </span>
            {item.notifyError ? (
              <span className="col-span-2 inline-flex items-center gap-1 text-[0.72rem] text-error">
                <AlertTriangle size={11} aria-hidden />
                QQ 推送失败
              </span>
            ) : null}
          </button>
        </li>
      );
    })}
  </ul>
);
