import { ChevronRight } from 'lucide-react';
import type { SubmissionItem } from '~/admin/lib/api';
import { statusLabel, statusTone } from '~/admin/lib/status';
import { formatShanghai, formatShanghaiShort } from '~/admin/lib/time';
import { CopyJsonButton } from '~/admin/modules/submissions/CopyJsonButton';
import {
  submissionSummary,
  typeLabel,
  typeTone,
} from '~/admin/modules/submissions/labels';
import { renderPayload } from '~/admin/modules/submissions/renderPayload';
import { StatusControls } from '~/admin/modules/submissions/StatusControls';
import { cn } from '~/lib/cn';

type Props = {
  item: SubmissionItem;
  open: boolean;
  onToggle: () => void;
  onUpdated: (item: SubmissionItem) => void;
  onUnauthorized: () => void;
};

const MetaRow = ({ label, children }: { label: string; children: string }) => (
  <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2 text-[0.78rem]">
    <dt className="text-icon">{label}</dt>
    <dd className="m-0 break-all font-mono">{children}</dd>
  </div>
);

/** One ledger line: status spine, type, preview, stamp — detail on demand. */
export const SubmissionRow = ({
  item,
  open,
  onToggle,
  onUpdated,
  onUnauthorized,
}: Props) => {
  const summary = submissionSummary(item);

  return (
    <li
      className={cn(
        'overflow-hidden rounded-lg border border-l-[3px] border-line',
        open ? 'bg-elev' : 'bg-panel',
      )}
      style={{ borderLeftColor: statusTone(item.status) }}
    >
      <div className="relative flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-mist">
        {/* Stretched hit area, so the copy button can live in the same row
            without nesting one button inside another. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${typeLabel(item.type)}：${summary}`}
          className="absolute inset-0 z-0 rounded-md focus-visible:outline-offset-[-3px]"
        />
        <span
          className="w-[4.5rem] shrink-0 truncate font-mono text-[0.68rem] tracking-wide"
          style={{ color: typeTone(item.type) }}
        >
          {typeLabel(item.type)}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-[0.9rem] leading-snug">{summary}</span>
          <span className="flex items-center gap-1.5 text-[0.74rem] text-icon">
            <span style={{ color: statusTone(item.status) }}>
              {statusLabel(item.status)}
            </span>
            <span aria-hidden>·</span>
            <span className="font-mono">{item.id.slice(-8)}</span>
          </span>
        </span>
        <CopyJsonButton value={item} />
        <span className="hidden shrink-0 font-mono text-[0.76rem] tabular-nums text-icon sm:block">
          {formatShanghaiShort(item.createdAt)}
        </span>
        <ChevronRight
          size={15}
          aria-hidden
          className={cn(
            'shrink-0 text-icon transition-transform',
            open && 'rotate-90',
          )}
        />
      </div>

      {open ? (
        <div className="border-t border-line px-3 pb-4">
          <StatusControls
            item={item}
            onUpdated={onUpdated}
            onUnauthorized={onUnauthorized}
          />
          {renderPayload(item.payload ?? {})}
          <dl className="m-0 mt-4 grid gap-1.5 border-t border-dashed border-line pt-3">
            <MetaRow label="提交于">{formatShanghai(item.createdAt)}</MetaRow>
            <MetaRow label="id">{item.id}</MetaRow>
            <MetaRow label="ipHash">{item.ipHash ?? '—'}</MetaRow>
            <MetaRow label="ua">{item.ua ?? '—'}</MetaRow>
          </dl>
        </div>
      ) : null}
    </li>
  );
};
