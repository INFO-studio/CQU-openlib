/** Admin module registry — add future tools here; shell reads this. */
export type AdminModule = {
  id: string;
  label: string;
  /** Absolute path under /admin */
  path: string;
  description: string;
};

export const ADMIN_MODULES = [
  {
    id: 'submissions',
    label: '表单收集',
    path: '/admin',
    description: '社区表单的全量提交记录',
  },
  {
    id: 'emails',
    label: '邮件往来',
    path: '/admin/emails',
    description: 'contact 信箱的收信与回复',
  },
  {
    id: 'file-failures',
    label: '直链监控',
    path: '/admin/file-failures',
    description: 'File API 的失败计数与明细',
  },
] as const satisfies readonly AdminModule[];

const LOCAL_CODE_KEY = 'cqu-openlib:admin-local';
/** Set only after a group code has been accepted. A bare local code is not a login. */
const LOCAL_READY_KEY = 'cqu-openlib:admin-local-ready';
const SESSION_KEY = 'cqu-openlib:admin-session';
/** Previous daily-key slot. Lock drops it so it cannot linger. */
const LEGACY_SESSION_KEY = 'cqu-openlib:admin-key';

type StoredSession = {
  token: string;
  expiresAt: number;
};

const storage = (kind: 'local' | 'session'): Storage | null => {
  try {
    return kind === 'local' ? localStorage : sessionStorage;
  } catch {
    return null;
  }
};

export const readLocalCode = (): string =>
  storage('local')?.getItem(LOCAL_CODE_KEY)?.trim() ?? '';

export const readLocalReady = (): boolean =>
  storage('local')?.getItem(LOCAL_READY_KEY) === '1';

export const writeLocalCode = (code: string): void => {
  const box = storage('local');
  if (!box) return;
  const next = code.trim().toLowerCase();
  if (!next) {
    box.removeItem(LOCAL_CODE_KEY);
    box.removeItem(LOCAL_READY_KEY);
    return;
  }
  box.setItem(LOCAL_CODE_KEY, next);
};

export const markLocalReady = (): void => {
  storage('local')?.setItem(LOCAL_READY_KEY, '1');
};

const readStoredSession = (): StoredSession | null => {
  const raw = storage('local')?.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

/** Session token, or '' once the day is over. The group code is not stored. */
export const readAdminKey = (): string => {
  const stored = readStoredSession();
  if (!stored) return '';
  if (stored.expiresAt <= Date.now()) {
    storage('local')?.removeItem(SESSION_KEY);
    return '';
  }
  return stored.token;
};

export const writeSession = (token: string, expiresAt: number): void => {
  storage('local')?.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
};

/** Drops the session. The local code stays, so the next login only needs the group code. */
export const clearAdminKey = (): void => {
  storage('local')?.removeItem(SESSION_KEY);
  storage('session')?.removeItem(LEGACY_SESSION_KEY);
};
