import { type AdminResult, adminFetch } from '~/admin/lib/adminFetch';

export type EmailDirection = 'inbound' | 'outbound';

export type EmailAttachmentMeta = {
  filename: string;
  contentType: string | null;
  size: number | null;
};

export type EmailSummary = {
  id: string;
  direction: EmailDirection;
  from: string;
  to: string[];
  subject: string;
  preview: string;
  attachmentCount: number;
  createdAt: string;
  notifiedAt: string | null;
  notifyError: string | null;
};

export type EmailDetail = EmailSummary & {
  text: string | null;
  html: string | null;
  textTruncated: boolean;
  htmlTruncated: boolean;
  attachments: EmailAttachmentMeta[];
  messageId: string | null;
};

export type EmailListResponse = AdminResult<{
  count?: number;
  items?: EmailSummary[];
}>;

export type EmailDetailResponse = AdminResult<{ item?: EmailDetail }>;

export const fetchEmails = (opts?: { key?: string }) =>
  adminFetch<{ count?: number; items?: EmailSummary[] }>('/admin/emails', {
    key: opts?.key,
  }) as Promise<EmailListResponse>;

export const fetchEmail = (id: string) =>
  adminFetch<{ item?: EmailDetail }>(
    `/admin/emails?id=${encodeURIComponent(id)}`,
  ) as Promise<EmailDetailResponse>;

export type ApprovalResponse = AdminResult<{
  id?: string;
  expiresAt?: string;
}>;

/**
 * Step one of sending: park the draft and have the bot DM it to the owner for
 * approval. The response carries the draft's id; the key that releases it goes
 * to QQ and never over HTTP.
 */
export const requestApproval = (body: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
}) =>
  adminFetch<{ id?: string; expiresAt?: string }>('/admin/emails/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<ApprovalResponse>;

/**
 * Step two: release the parked draft. The mail's content is not resent here —
 * the server already holds it, which is what makes the key an approval of one
 * specific message.
 */
export const releaseEmail = (body: { id: string; key: string }) =>
  adminFetch<{ item?: EmailDetail }>('/admin/emails/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<EmailDetailResponse>;

/** `Name <addr@host>` → parts; bare addresses keep an empty name. */
export const parseAddress = (
  raw: string,
): { name: string; address: string } => {
  const match = raw.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (!match) return { name: '', address: raw.trim() };
  return {
    name: (match[1] ?? '').replace(/^"|"$/g, '').trim(),
    address: (match[2] ?? '').trim(),
  };
};

/** Who the maintainer is talking to, whichever way the mail went. */
export const counterpart = (email: EmailSummary): string =>
  email.direction === 'inbound'
    ? parseAddress(email.from).address
    : parseAddress(email.to[0] ?? '').address;

export const replySubject = (subject: string): string =>
  /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;

export const formatBytes = (n: number | null): string => {
  if (n == null || !Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};
