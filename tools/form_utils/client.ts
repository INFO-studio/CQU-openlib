import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStatus, type Submission } from './types';

const API_BASE = 'https://api.cqu-openlib.cn';
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const LOCAL_ENV = resolve(CURRENT_DIR, '../../.env');
const DEFAULT_SESSION_CACHE_PATH = resolve(CURRENT_DIR, 'data/.session.json');
const SESSION_REFRESH_SKEW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_CODE_RE = /^[0-9a-z]{8}$/;
const GROUP_CODE_RE = /^[0-9a-z]{4}$/;

export type AdminAuthInput = {
  token?: string;
  localCode?: string;
  groupCode?: string;
};

export type ResolvedAdminAuth =
  | { kind: 'token'; token: string }
  | { kind: 'codes'; localCode: string; groupCode: string };

export type SessionCacheEntry = {
  api: string;
  groupCode: string;
  localCodeHash: string;
  token: string;
  expiresAt: number;
};

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type SessionClientOptions = AdminAuthInput & {
  api: string;
  fetchImpl?: FetchLike;
  cachePath?: string;
  now?: () => number;
  env?: Record<string, string | undefined>;
  envText?: string;
};

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

const loadLocalEnvText = (): string =>
  existsSync(LOCAL_ENV) ? readFileSync(LOCAL_ENV, 'utf8') : '';

/**
 * Resolve admin auth: `--token` / `ADMIN_SESSION_TOKEN` wins; otherwise read
 * `ADMIN_LOCAL_CODE` and `ADMIN_GROUP_CODE` from flags, env, or repo `.env`.
 */
export const resolveAdminAuth = (
  explicit: AdminAuthInput,
  env: Record<string, string | undefined> = process.env,
  envText = loadLocalEnvText(),
): ResolvedAdminAuth => {
  const token = explicit.token?.trim() || env.ADMIN_SESSION_TOKEN?.trim() || '';
  if (token) return { kind: 'token', token };

  const rawLocal =
    explicit.localCode?.trim() ||
    env.ADMIN_LOCAL_CODE?.trim() ||
    readEnvValue(envText, 'ADMIN_LOCAL_CODE').trim();
  const rawGroup =
    explicit.groupCode?.trim() ||
    env.ADMIN_GROUP_CODE?.trim() ||
    readEnvValue(envText, 'ADMIN_GROUP_CODE').trim();

  if (!rawLocal || !rawGroup) {
    throw new Error(
      '缺少维护台凭证：请在 .env 或环境变量配置 ADMIN_LOCAL_CODE 与 ADMIN_GROUP_CODE，或传 --local-code / --group-code / --token',
    );
  }

  const localCode = rawLocal.toLowerCase();
  const groupCode = rawGroup.toLowerCase();
  if (!LOCAL_CODE_RE.test(localCode)) {
    throw new Error('ADMIN_LOCAL_CODE 格式无效：需要 8 位数字或字母');
  }
  if (!GROUP_CODE_RE.test(groupCode)) {
    throw new Error('ADMIN_GROUP_CODE 格式无效：需要 4 位数字或字母');
  }

  return { kind: 'codes', localCode, groupCode };
};

const hashLocalCodeForCache = (localCode: string): string =>
  createHash('sha256').update(localCode).digest('hex');

const readCachedSession = (
  cachePath: string,
  api: string,
  localCode: string,
  groupCode: string,
  nowMs: number,
): string | null => {
  if (!existsSync(cachePath)) return null;
  try {
    const parsed = asRecord(JSON.parse(readFileSync(cachePath, 'utf8')));
    const cachedApi = asString(parsed.api);
    const cachedGroup = asString(parsed.groupCode);
    const cachedHash = asString(parsed.localCodeHash);
    const token = asString(parsed.token);
    const expiresAt = parsed.expiresAt;
    if (
      cachedApi !== api ||
      cachedGroup !== groupCode ||
      cachedHash !== hashLocalCodeForCache(localCode) ||
      !token ||
      typeof expiresAt !== 'number' ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= nowMs + SESSION_REFRESH_SKEW_MS
    ) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
};

const writeCachedSession = (
  cachePath: string,
  entry: SessionCacheEntry,
): void => {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(entry, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  chmodSync(cachePath, 0o600);
};

const clearCachedSession = (cachePath: string): void => {
  rmSync(cachePath, { force: true });
};

type SessionResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  expiresAt?: number;
};

const exchangeSession = async (opts: {
  base: string;
  localCode: string;
  groupCode: string;
  fetchImpl: FetchLike;
  cachePath: string;
  nowMs: number;
}): Promise<string> => {
  const res = await opts
    .fetchImpl(`${opts.base}/admin/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localCode: opts.localCode,
        groupCode: opts.groupCode,
      }),
    })
    .catch(() => {
      throw new Error(`连不上 ${opts.base}`);
    });

  const data = (await res.json().catch(() => null)) as SessionResponse | null;
  if (res.status === 429) {
    throw new Error('请求过于频繁，稍后再试');
  }
  if (!res.ok || !data?.success || !data.token) {
    throw new Error(data?.message?.trim() || `登录失败（${res.status}）`);
  }

  const expiresAt =
    typeof data.expiresAt === 'number' && Number.isFinite(data.expiresAt)
      ? data.expiresAt
      : opts.nowMs + DAY_MS;

  writeCachedSession(opts.cachePath, {
    api: opts.base,
    groupCode: opts.groupCode,
    localCodeHash: hashLocalCodeForCache(opts.localCode),
    token: data.token,
    expiresAt,
  });

  return data.token;
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

type AdminAttempt =
  | { ok: true; data: AdminBody }
  | { ok: false; reason: 'unauthorized' };

const requestAdmin = async (
  url: string,
  init: RequestInit,
  base: string,
  fetchImpl: FetchLike,
): Promise<AdminAttempt> => {
  const res = await fetchImpl(url, init).catch(() => {
    throw new Error(`连不上 ${base}`);
  });
  const data = (await res.json().catch(() => null)) as AdminBody | null;
  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  if (res.status === 429) throw new Error('请求过于频繁，稍后再试');
  if (!res.ok || !data?.success) {
    throw new Error(data?.message?.trim() || `请求失败（${res.status}）`);
  }
  return { ok: true, data };
};

const withAdminToken = async (
  opts: SessionClientOptions,
  url: string,
  makeInit: (token: string) => RequestInit,
): Promise<AdminBody> => {
  const base = (opts.api || API_BASE).replace(/\/$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;
  const cachePath = opts.cachePath ?? DEFAULT_SESSION_CACHE_PATH;
  const nowMs = (opts.now ?? Date.now)();
  const auth = resolveAdminAuth(opts, opts.env, opts.envText);

  if (auth.kind === 'token') {
    const attempt = await requestAdmin(
      url,
      makeInit(auth.token),
      base,
      fetchImpl,
    );
    if (!attempt.ok) throw new Error('会话无效或已过期');
    return attempt.data;
  }

  const cached = readCachedSession(
    cachePath,
    base,
    auth.localCode,
    auth.groupCode,
    nowMs,
  );
  if (cached) {
    const first = await requestAdmin(url, makeInit(cached), base, fetchImpl);
    if (first.ok) return first.data;
    clearCachedSession(cachePath);
  }

  const freshToken = await exchangeSession({
    base,
    localCode: auth.localCode,
    groupCode: auth.groupCode,
    fetchImpl,
    cachePath,
    nowMs,
  });
  const attempt = await requestAdmin(
    url,
    makeInit(freshToken),
    base,
    fetchImpl,
  );
  if (!attempt.ok) throw new Error('会话无效或已过期');
  return attempt.data;
};

export const fetchSubmissions = async (
  opts: SessionClientOptions & {
    type: string;
    status: string;
  },
): Promise<Submission[]> => {
  const params = new URLSearchParams();
  if (opts.type) params.set('type', opts.type);
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const base = (opts.api || API_BASE).replace(/\/$/, '');

  const data = await withAdminToken(
    opts,
    `${base}/admin/submissions${qs}`,
    (token) => ({ headers: { Authorization: `Bearer ${token}` } }),
  );
  if (!Array.isArray(data.items)) throw new Error('请求失败');
  return data.items.map(normalizeItem);
};

export const transitionSubmission = async (
  opts: SessionClientOptions & {
    id: string;
    status: string;
    completionNote?: string;
  },
): Promise<Submission> => {
  const base = (opts.api || API_BASE).replace(/\/$/, '');
  const body: Record<string, string> = { id: opts.id, status: opts.status };
  if (opts.completionNote !== undefined) {
    body.completionNote = opts.completionNote;
  }
  const data = await withAdminToken(
    opts,
    `${base}/admin/submissions/status`,
    (token) => ({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  if (!data.item) throw new Error('请求失败');
  return normalizeItem(data.item);
};
