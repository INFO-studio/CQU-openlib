import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { SubmissionItem } from '~/admin/lib/api';
import { transitionSubmissionStatus } from '~/admin/lib/api';
import {
  nextStatuses,
  type SubmissionStatus,
  statusLabel,
} from '~/admin/lib/status';
import { formatShanghai } from '~/admin/modules/submissions/labels';

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
    <div className="admin-status">
      <div className="admin-status__row">
        <span className="admin-status__label">状态流转</span>
        <div className="admin-status__actions">
          {targets.map((s) => (
            <button
              key={s}
              type="button"
              className="admin-status__btn"
              disabled={Boolean(busy)}
              onClick={() => void run(s, false)}
            >
              {busy === s ? '…' : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {canMarkCompleted ? (
        <form className="admin-status__complete" onSubmit={onComplete}>
          <label
            className="admin-status__note-label"
            htmlFor={`note-${item.id}`}
          >
            变更完成备注
          </label>
          <textarea
            id={`note-${item.id}`}
            className="admin-status__note"
            rows={2}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="可选：记录处理说明"
          />
          <button
            type="submit"
            className="admin-status__btn admin-status__btn--done"
            disabled={Boolean(busy)}
          >
            {busy === 'completed' ? '提交中…' : '标为变更完成'}
          </button>
        </form>
      ) : null}

      {item.status === 'completed' ? (
        <dl className="admin-status__meta">
          <div>
            <dt>完成时间</dt>
            <dd>
              {item.completedAt
                ? formatShanghai(
                    typeof item.completedAt === 'string'
                      ? item.completedAt
                      : String(item.completedAt),
                  )
                : '—'}
            </dd>
          </div>
          <div>
            <dt>完成备注</dt>
            <dd className="admin-status__meta-note">
              {item.completionNote?.trim() || '—'}
            </dd>
          </div>
        </dl>
      ) : null}

      {error ? <p className="admin-gate__error">{error}</p> : null}
    </div>
  );
};
