export const cleanPath = (path: string): string => {
  return path.replace(/\/+$/, '') || '/';
};
export const decodePathname = (pathname: string): string => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
};
export type NavTarget =
  | {
      to: '/';
    }
  | {
      to: '/$';
      params: {
        _splat: string;
      };
    };
export const toNavTarget = (path: string): NavTarget => {
  const clean = cleanPath(path);
  if (clean === '/') return { to: '/' };
  return {
    to: '/$',
    params: { _splat: clean.replace(/^\//, '') },
  };
};
