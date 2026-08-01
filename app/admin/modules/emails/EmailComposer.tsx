import { KeyRound, Pencil, Send, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { AdminError } from '~/admin/AdminShell';
import {
  type EmailDetail,
  releaseEmail,
  requestApproval,
} from '~/admin/lib/emails';
import { formatShanghaiClock } from '~/admin/lib/time';
import { ActivitySpinner } from '~/components/ui/activity-spinner';

/** Reply threads onto `inReplyTo` and locks the recipient; new mail is free. */
export type ComposerDraft = {
  to: string;
  subject: string;
  inReplyTo?: string;
  /** Recipient came from an archived mail and must not be retargeted. */
  locked: boolean;
};

type Props = {
  draft: ComposerDraft;
  onSent: (item: EmailDetail) => void;
  onUnauthorized: () => void;
};

/** A draft parked on the server, waiting for the owner's key. */
type Pending = { id: string; expiresAt: string | null };

const FIELD =
  'w-full rounded-md border border-line bg-elev px-2.5 py-1.5 font-mono text-[0.84rem] transition-colors focus:border-primary disabled:text-icon';

/** Parent keys this by reply target, so switching mails resets the draft. */
export const EmailComposer = ({ draft, onSent, onUnauthorized }: Props) => {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (res: { message?: string }, fallback: string) => {
    if (res.message === 'unauthorized') onUnauthorized();
    else setError(res.message || fallback);
  };

  const onRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await requestApproval({
      to: to.trim(),
      subject: subject.trim(),
      text,
      ...(draft.inReplyTo ? { inReplyTo: draft.inReplyTo } : {}),
    });
    setBusy(false);
    if (!res.success || !res.id) {
      fail(res, '提交审批失败');
      return;
    }
    setPending({ id: res.id, expiresAt: res.expiresAt ?? null });
  };

  const onRelease = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !pending) return;
    setBusy(true);
    setError(null);
    const res = await releaseEmail({ id: pending.id, key: key.trim() });
    setBusy(false);
    if (!res.success || !res.item) {
      // A wrong key leaves the draft parked, so stay put and let them retype.
      fail(res, '发送失败');
      setKey('');
      return;
    }
    setText('');
    setKey('');
    setPending(null);
    onSent(res.item);
  };

  // Once parked, the server holds the letter. Editing the fields here would
  // only desync the copy on screen from the copy the owner is reading.
  const editable = !pending;
  const ready = to.trim() && subject.trim() && text.trim();

  return (
    <form
      onSubmit={pending ? onRelease : onRequest}
      className="mt-5 rounded-xl border border-line bg-panel p-3.5"
    >
      <p className="m-0 mb-2.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-icon">
        {draft.inReplyTo ? 'reply' : 'compose'}
      </p>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <label className="grid gap-1">
          <span className="text-[0.74rem] text-icon">收件人</span>
          <input
            type="email"
            value={to}
            disabled={draft.locked || !editable}
            onChange={(e) => setTo(e.target.value)}
            placeholder="someone@example.com"
            className={FIELD}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[0.74rem] text-icon">主题</span>
          <input
            type="text"
            value={subject}
            disabled={!editable}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="邮件主题"
            className={FIELD}
          />
        </label>
      </div>

      <label className="mt-2.5 grid gap-1">
        <span className="text-[0.74rem] text-icon">正文（纯文本）</span>
        <textarea
          value={text}
          disabled={!editable}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="直接写正文，落款由模板补上。"
          className="w-full resize-y rounded-md border border-line bg-elev px-2.5 py-2 text-[0.88rem] leading-relaxed transition-colors focus:border-primary disabled:text-muted"
        />
      </label>

      {pending ? (
        <div className="mt-3 rounded-lg border border-line bg-mist p-3">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[0.8rem] font-semibold text-ink">
              已提交审批
            </span>
            <span className="font-mono text-[0.8rem] tracking-[0.1em] text-primary">
              #{pending.id}
            </span>
            {pending.expiresAt ? (
              <span className="text-[0.74rem] text-icon">
                {formatShanghaiClock(pending.expiresAt)} 前有效
              </span>
            ) : null}
          </div>
          <p className="m-0 mt-1 text-[0.76rem] leading-relaxed text-muted">
            全文已私信给站长。核对私信里的编号一致后，输入他给的口令放行。
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <KeyRound size={14} className="text-icon" aria-hidden />
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="放行口令"
              autoComplete="off"
              spellCheck={false}
              // biome-ignore lint/a11y/noAutofocus: the only field left to fill
              autoFocus
              className="w-[9.5rem] rounded-md border border-line bg-elev px-2.5 py-1.5 font-mono text-[0.9rem] uppercase tracking-[0.14em] transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setKey('');
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-[0.8rem] text-muted transition-colors hover:bg-panel hover:text-ink"
            >
              <Pencil size={13} aria-hidden />
              重新编辑
            </button>
          </div>
        </div>
      ) : null}

      {error ? <AdminError>{error}</AdminError> : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="m-0 text-[0.74rem] text-icon">
          {pending
            ? '口令只放行这一封，用一次即失效'
            : '以 contact@cqu-openlib.cn 发出，提交后由站长审批'}
        </p>
        <button
          type="submit"
          disabled={busy || (pending ? !key.trim() : !ready)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-paper transition-opacity disabled:opacity-45"
        >
          {busy ? (
            <ActivitySpinner size={14} label="处理中" />
          ) : pending ? (
            <Send size={13} aria-hidden />
          ) : (
            <ShieldCheck size={13} aria-hidden />
          )}
          {busy ? '处理中…' : pending ? '放行发出' : '提交审批'}
        </button>
      </div>
    </form>
  );
};
