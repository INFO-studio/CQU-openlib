/** Admin module registry — add future tools here; shell reads this. */
export type AdminModule = {
  id: string;
  label: string;
  /** Absolute path under /admin */
  path: string;
  description: string;
};

export const ADMIN_MODULES: readonly AdminModule[] = [
  {
    id: 'submissions',
    label: '表单收集',
    path: '/admin',
    description: '社区表单的全量提交记录',
  },
] as const;

export const ADMIN_SESSION_KEY = 'cqu-openlib:admin-key';

export const readAdminKey = (): string => {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
};

export const writeAdminKey = (key: string): void => {
  sessionStorage.setItem(ADMIN_SESSION_KEY, key.trim());
};

export const clearAdminKey = (): void => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
};
