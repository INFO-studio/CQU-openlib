import type { CampusId } from '~/pages/map/data';

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
      hash?: string;
    }
  | {
      to: '/map';
      hash?: string;
      search?: {
        campus?: CampusId;
        focus?: string;
      };
    }
  | {
      to: '/$';
      params: {
        _splat: string;
      };
      hash?: string;
    };
export const toNavTarget = (path: string): NavTarget => {
  const hashIndex = path.indexOf('#');
  const hash =
    hashIndex >= 0 ? path.slice(hashIndex + 1) || undefined : undefined;
  const hashTarget = hash ? { hash } : {};
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [pathname, query = ''] = pathWithoutHash.split('?', 2);
  const clean = cleanPath(pathname);
  if (clean === '/') return { to: '/', ...hashTarget };
  if (clean === '/map') {
    const params = new URLSearchParams(query);
    const campus = params.get('campus');
    const focus = params.get('focus');
    const search: { campus?: CampusId; focus?: string } = {
      campus:
        campus === 'a' ||
        campus === 'b' ||
        campus === 'c' ||
        campus === 'd' ||
        campus === 'e'
          ? campus
          : undefined,
      focus: focus || undefined,
    };
    return search.campus || search.focus
      ? { to: '/map', search, ...hashTarget }
      : { to: '/map', ...hashTarget };
  }
  return {
    to: '/$',
    params: { _splat: clean.replace(/^\//, '') },
    ...hashTarget,
  };
};
