/** Backend API origin, e.g. https://api.cqu-openlib.cn */
export const apiBase = (): string => {
  const raw = import.meta.env.VITE_API_BASE as string | undefined;
  return (raw ?? '').replace(/\/+$/, '');
};

export const apiUrl = (path: string): string => {
  const base = apiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
};
