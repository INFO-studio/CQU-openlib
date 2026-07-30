import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { AdminError } from '~/admin/AdminShell';
import type { SubmissionItem } from '~/admin/lib/api';
import { transitionSubmissionStatus } from '~/admin/lib/api';
import {
  nextStatuses,
  type SubmissionStatus,
  statusLabel,
  statusTone,
} from '~/admin/lib/status';
import { formatShanghai } from '~/admin/modules/submissions/labels';
import { cn } from '~/lib/cn';

const ACTION =
  'rounded-md border border-line bg-panel px-2.5 py-1.5 text-[0.8rem] text-muted transition-colors hover:bg-mist hover:text-ink disabled:opacity-55 disabled:pointer-events-none';

type Props = {
  item: SubmissionItem;
  onUpdated: (item: SubmissionItem) => void;
  onUnauthorized: () => void;
};

export const StatusControls = ({ item, onUpdated, onUnauthorized }: Props) => {
  const targets = nextStatuses(item.status);
  const canMarkCompleted = targets.includes('completed');
  const [note, setNote] = useState(item.completionNote ?? '');
  const [busy, setBusy] = useState<SubmissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote(item.completionNote ?? '');
  }, [item.id, item.completionNote]);

  const run = async (next: SubmissionStatus, withNote: boolean) => {
    if (busy) return;
    setError(null);
    setBusy(next);
    try {
      const res = await transitionSubmissionStatus({
        id: item.id,
        status: next,
        ...(withNote || next === 'completed' ? { completionNote: note } : {}),
      });
      if (!res.success || !res.item) {
        if (res.message === 'unauthorized') onUnauthorized();
        else setError(res.message || '流转失败');
        return;
      }
      setNote(res.item.completionNote ?? '');
      onUpdated(res.item);
    } finally {
      setBusy(null);
    }
  };

  const onComplete = (e: FormEvent) => {
    e.preventDefault();
    void run('completed', true);
  };

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-icon">
          状态流转
        </span>
        <div className="flex flex-wrap gap-1.5">
          {targets.map((s) => (
            <button
              key={s}
              type="button"
              className={ACTION}
              disabled={Boolean(busy)}
              onClick={() => void run(s, false)}
            >
              {busy === s ? '…' : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {canMarkCompleted ? (
        <form className="grid gap-1.5" onSubmit={onComplete}>
          <label
            className="text-[0.76rem] text-icon"
            htmlFor={`note-${item.id}`}
          >
            变更完成备注
          </label>
          <textarea
            id={`note-${item.id}`}
            rows={2}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="可选：记录处理说明"
            className="min-h-[3.2rem] w-full resize-y rounded-md border border-line bg-panel px-2.5 py-2 text-[0.86rem] transition-colors focus:border-primary"
          />
          <button
            type="submit"
            disabled={Boolean(busy)}
            style={{ color: statusTone('completed') }}
            className={cn(ACTION, 'justify-self-start')}
          >
            {busy === 'completed' ? '提交中…' : '标为变更完成'}
          </button>
        </form>
      ) : null}

      {item.status === 'completed' ? (
        <dl className="m-0 grid gap-1.5 border-t border-dashed border-line pt-2.5">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-[0.78rem]">
            <dt className="text-icon">完成时间</dt>
            <dd className="m-0">
              {item.completedAt ? formatShanghai(item.completedAt) : '—'}
            </dd>
          </div>
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-[0.78rem]">
            <dt className="text-icon">完成备注</dt>
            <dd className="m-0 whitespace-pre-wrap break-words">
              {item.completionNote?.trim() || '—'}
            </dd>
          </div>
        </dl>
      ) : null}

      {error ? <AdminError>{error}</AdminError> : null}
    </div>
  );
};
