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
    id: 'analytics',
    label: '访问统计',
    path: '/admin/analytics',
    description: '页面、下载与搜索的访问记录',
  },
] as const satisfies readonly AdminModule[];

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
