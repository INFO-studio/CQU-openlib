import { PenLine, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminError } from '~/admin/AdminShell';
import {
  counterpart,
  type EmailDetail,
  type EmailSummary,
  fetchEmail,
  fetchEmails,
  replySubject,
} from '~/admin/lib/emails';
import {
  type ComposerDraft,
  EmailComposer,
} from '~/admin/modules/emails/EmailComposer';
import { EmailList } from '~/admin/modules/emails/EmailList';
import { EmailReader } from '~/admin/modules/emails/EmailReader';
import { ActivitySpinner } from '~/components/ui/activity-spinner';

type Props = {
  /** Bumps when the shell unlocks / reloads. */
  refreshToken: number;
  onUnauthorized: () => void;
};

const ACTION =
  'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-[0.8rem] text-muted transition-colors hover:bg-mist hover:text-ink disabled:cursor-progress disabled:opacity-50';

export const EmailsPage = ({ refreshToken, onUnauthorized }: Props) => {
  const [items, setItems] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [composingNew, setComposingNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchEmails();
    if (!res.success) {
      if (res.message === 'unauthorized') onUnauthorized();
      else setError(res.message || '加载失败');
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(res.items ?? []);
    setLoading(false);
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const open = useCallback(
    async (id: string) => {
      setComposingNew(false);
      setSelectedId(id);
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      const res = await fetchEmail(id);
      setDetailLoading(false);
      if (!res.success || !res.item) {
        if (res.message === 'unauthorized') onUnauthorized();
        else setDetailError(res.message || '读取失败');
        return;
      }
      setDetail(res.item);
    },
    [onUnauthorized],
  );

  const onSent = useCallback(
    (item: EmailDetail) => {
      setComposingNew(false);
      setSelectedId(item.id);
      setDetail(item);
      void load();
    },
    [load],
  );

  const draft: ComposerDraft | null = composingNew
    ? { to: '', subject: '', locked: false }
    : detail
      ? {
          to: counterpart(detail),
          subject: replySubject(detail.subject),
          inReplyTo: detail.id,
          locked: true,
        }
      : null;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section
        className="min-w-0 xl:sticky xl:top-6 xl:max-h-[calc(100vh-4.5rem)] xl:overflow-y-auto"
        aria-label="邮件列表"
      >
        <header className="mb-3 border-b border-line pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="m-0 font-display text-2xl font-semibold">
              邮件往来
            </h1>
            <p className="m-0 font-mono text-[0.74rem] tabular-nums tracking-wide text-icon">
              {items.length} 封
            </p>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setComposingNew(true);
                setSelectedId(null);
                setDetail(null);
                setDetailError(null);
              }}
              className={ACTION}
            >
              <PenLine size={13} className="text-icon" aria-hidden />
              写新邮件
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={ACTION}
            >
              <RefreshCw size={13} className="text-icon" aria-hidden />
              刷新
            </button>
          </div>
        </header>

        {error ? <AdminError>{error}</AdminError> : null}

        {loading ? (
          <div className="grid min-h-40 place-items-center text-icon" aria-busy>
            <ActivitySpinner size={26} label="加载中" />
          </div>
        ) : items.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-line px-4 py-10 text-center text-[0.86rem] text-icon">
            还没有往来邮件
          </p>
        ) : (
          <EmailList items={items} selectedId={selectedId} onSelect={open} />
        )}
      </section>

      <section className="min-w-0" aria-label="邮件内容">
        {detailLoading ? (
          <div className="grid min-h-64 place-items-center text-icon" aria-busy>
            <ActivitySpinner size={28} label="读取中" />
          </div>
        ) : detailError ? (
          <AdminError>{detailError}</AdminError>
        ) : detail ? (
          <EmailReader email={detail} />
        ) : composingNew ? null : (
          <p className="m-0 rounded-xl border border-dashed border-line px-4 py-16 text-center text-[0.88rem] text-icon">
            从左侧选一封邮件，或写一封新的
          </p>
        )}

        {draft ? (
          <EmailComposer
            key={draft.inReplyTo ?? 'new'}
            draft={draft}
            onSent={onSent}
            onUnauthorized={onUnauthorized}
          />
        ) : null}
      </section>
    </div>
  );
};
