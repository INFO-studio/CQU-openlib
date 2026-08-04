import { Paperclip } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  type EmailDetail,
  formatBytes,
  parseAddress,
} from '~/admin/lib/emails';
import { formatShanghai } from '~/admin/lib/time';

type Props = {
  email: EmailDetail;
};

const MetaRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 text-[0.78rem]">
    <dt className="text-icon">{label}</dt>
    <dd className="m-0 break-all font-mono text-muted">{children}</dd>
  </div>
);

const address = (raw: string): string => {
  const { name, address: addr } = parseAddress(raw);
  return name ? `${name} <${addr}>` : addr;
};

const Notice = ({ children }: { children: ReactNode }) => (
  <p className="m-0 mb-3 rounded-md bg-primary-soft px-2.5 py-1.5 text-[0.78rem] text-muted">
    {children}
  </p>
);

/** Read pane. Mail HTML never touches this document — see the iframe below. */
export const EmailReader = ({ email }: Props) => (
  <article className="min-w-0">
    <header className="border-b border-line pb-3.5">
      <h2 className="m-0 font-display text-[1.35rem] font-semibold leading-snug">
        {email.subject || '(无主题)'}
      </h2>
      <dl className="m-0 mt-2.5 grid gap-1">
        <MetaRow label="发件人">{address(email.from)}</MetaRow>
        <MetaRow label="收件人">{email.to.map(address).join('、')}</MetaRow>
        <MetaRow label="时间">{formatShanghai(email.createdAt)}</MetaRow>
        <MetaRow label="id">{email.id}</MetaRow>
      </dl>
      {email.notifyError ? (
        <p className="m-0 mt-2.5 rounded-md bg-error-soft px-2.5 py-1.5 text-[0.78rem] text-error">
          QQ 推送失败：{email.notifyError}
        </p>
      ) : null}
    </header>

    <div className="py-4">
      {email.textTruncated ? (
        <Notice>正文超过 256 KB，以下只是开头部分。</Notice>
      ) : null}
      {email.text?.trim() ? (
        <div className="whitespace-pre-wrap break-words text-[0.92rem] leading-relaxed">
          {email.text}
        </div>
      ) : (
        <p className="m-0 text-[0.88rem] text-icon">
          这封邮件没有纯文本正文{email.html ? '，展开下方 HTML 查看' : ''}。
        </p>
      )}
    </div>

    {email.html ? (
      <details className="rounded-lg border border-line bg-panel">
        <summary className="cursor-pointer select-none px-3 py-2 font-mono text-[0.74rem] uppercase tracking-[0.1em] text-icon">
          html 版本
        </summary>
        <div className="border-t border-line p-3">
          {email.htmlTruncated ? (
            <Notice>HTML 超过 512 KB 已截断，渲染可能不完整。</Notice>
          ) : null}
          {/* Sandboxed and without allow-scripts: a hostile sender's markup
              runs nowhere and can reach nothing. */}
          <iframe
            title="邮件 HTML 正文"
            sandbox=""
            srcDoc={email.html}
            className="h-[26rem] w-full rounded-md border border-line bg-white"
          />
        </div>
      </details>
    ) : null}

    {email.attachments.length > 0 ? (
      <section className="mt-4 border-t border-dashed border-line pt-3">
        <p className="m-0 mb-1.5 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-icon">
          附件 {email.attachments.length}
        </p>
        <ul className="m-0 grid list-none gap-1 p-0">
          {email.attachments.map((file) => (
            <li
              key={`${file.filename}-${file.size ?? 0}`}
              className="flex items-baseline gap-2 text-[0.82rem] text-muted"
            >
              <Paperclip size={12} aria-hidden className="shrink-0 text-icon" />
              <span className="break-all font-mono">{file.filename}</span>
              {file.size != null ? (
                <span className="shrink-0 font-mono text-[0.74rem] text-icon">
                  {formatBytes(file.size)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="m-0 mt-1.5 text-[0.76rem] text-icon">
          只存了文件名，下载请回 Resend 后台。
        </p>
      </section>
    ) : null}
  </article>
);
