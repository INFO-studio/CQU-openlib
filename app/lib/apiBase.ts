/** Backend API origin. */
export const API_BASE = 'https://api.cqu-openlib.cn';

export const apiBase = (): string => API_BASE;

export const apiUrl = (path: string): string => {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
};
