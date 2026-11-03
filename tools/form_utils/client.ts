import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStatus, type Submission } from './types';

const API_BASE = 'https://api.cqu-openlib.cn';

const SIBLING_ENV = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../CQU-openlib-api/.env',
);

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
};

const asNullableString = (value: unknown): string | null =>
  value == null ? null : asString(value);

export const shanghaiDate = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replaceAll('-', '');

const unquote = (value: string): string => {
  const wrapped =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return wrapped ? value.slice(1, -1) : value;
};

/** First `NAME=` assignment, ignoring comments and an optional `export`. */
export const readEnvValue = (text: string, name: string): string => {
  const line = text.split('\n').find((row) => {
    const trimmed = row.trim();
    if (!trimmed || trimmed.startsWith('#')) return false;
    const body = trimmed.startsWith('export ')
      ? trimmed.slice(7).trim()
      : trimmed;
    return body.startsWith(`${name}=`);
  });
  if (!line) return '';
  const trimmed = line.trim();
  const body = trimmed.startsWith('export ')
    ? trimmed.slice(7).trim()
    : trimmed;
  return unquote(body.slice(name.length + 1).trim());
};

const prefixFromEnvFile = (): string => {
  if (!existsSync(SIBLING_ENV)) return '';
  return readEnvValue(
    readFileSync(SIBLING_ENV, 'utf8'),
    'ADMIN_PAGE_TOKEN_PREFIX',
  ).trim();
};

/**
 * Full bearer token. `--key` wins; otherwise prefix + Asia/Shanghai YYYYMMDD.
 * The prefix comes from the environment, then the sibling API repo `.env`.
 */
export const resolveAdminKey = (explicit: string, now = new Date()): string => {
  const given = explicit.trim();
  if (given) return given;
  const prefix =
    process.env.ADMIN_PAGE_TOKEN_PREFIX?.trim() || prefixFromEnvFile();
  if (!prefix) {
    throw new Error(
      '缺少管理密钥：传 --key，或设置 ADMIN_PAGE_TOKEN_PREFIX，或在 CQU-openlib-api/.env 里提供该变量',
    );
  }
  return `${prefix}${shanghaiDate(now)}`;
};

const normalizeItem = (raw: unknown): Submission => {
  const doc = asRecord(raw);
  return {
    id: asString(doc.id),
    type: asString(doc.type),
    payload: asRecord(doc.payload),
    ua: asNullableString(doc.ua),
    ipHash: asNullableString(doc.ipHash),
    createdAt: asString(doc.createdAt),
    status: normalizeStatus(doc.status),
    completionNote:
      typeof doc.completionNote === 'string' ? doc.completionNote : null,
    completedAt:
      doc.completedAt == null ? null : asNullableString(doc.completedAt),
  };
};

type AdminBody = {
  success?: boolean;
  message?: string;
  items?: unknown[];
  item?: unknown;
};

const requestAdmin = async (
  url: string,
  init: RequestInit,
  base: string,
): Promise<AdminBody> => {
  const res = await fetch(url, init).catch(() => {
    throw new Error(`连不上 ${base}`);
  });
  const data = (await res.json().catch(() => null)) as AdminBody | null;
  if (res.status === 401) throw new Error('密钥无效');
  if (res.status === 429) throw new Error('请求过于频繁，稍后再试');
  if (!res.ok || !data?.success) {
    throw new Error(data?.message?.trim() || `请求失败（${res.status}）`);
  }
  return data;
};

export const fetchSubmissions = async (opts: {
  api: string;
  key: string;
  type: string;
  status: string;
}): Promise<Submission[]> => {
  const key = resolveAdminKey(opts.key);
  const params = new URLSearchParams();
  if (opts.type) params.set('type', opts.type);
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const base = (opts.api || API_BASE).replace(/\/$/, '');

  const data = await requestAdmin(
    `${base}/admin/submissions${qs}`,
    { headers: { Authorization: `Bearer ${key}` } },
    base,
  );
  if (!Array.isArray(data.items)) throw new Error('请求失败');
  return data.items.map(normalizeItem);
};

export const transitionSubmission = async (opts: {
  api: string;
  key: string;
  id: string;
  status: string;
  completionNote?: string;
}): Promise<Submission> => {
  const key = resolveAdminKey(opts.key);
  const base = (opts.api || API_BASE).replace(/\/$/, '');
  const body: Record<string, string> = { id: opts.id, status: opts.status };
  if (opts.completionNote !== undefined) {
    body.completionNote = opts.completionNote;
  }
  const data = await requestAdmin(
    `${base}/admin/submissions/status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    base,
  );
  if (!data.item) throw new Error('请求失败');
  return normalizeItem(data.item);
};
