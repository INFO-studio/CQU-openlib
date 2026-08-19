import type { MapSearch } from '~/pages/map/type';
import { validateMapSearch } from '~/pages/map/utils/mapSearch';

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
      search?: MapSearch;
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
    const search = validateMapSearch({
      campus: params.get('campus'),
      filter: params.get('filter'),
      focus: params.get('focus'),
    });
    return Object.keys(search).length
      ? { to: '/map', search, ...hashTarget }
      : { to: '/map', ...hashTarget };
  }
  return {
    to: '/$',
    params: { _splat: clean.replace(/^\//, '') },
    ...hashTarget,
  };
};
