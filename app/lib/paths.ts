import type { GraduationSearch } from '~/pages/academic/graduation/utils/scopeSearch';
import { validateGraduationSearch } from '~/pages/academic/graduation/utils/scopeSearch';
import type { MapSearch } from '~/pages/map/type';
import { validateMapSearch } from '~/pages/map/utils/mapSearch';

export const cleanPath = (path: string): string => {
  return path.replace(/\/+$/, '') || '/';
};

const decodeOnce = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Decode malformed repeatedly-encoded incoming paths without looping forever. */
export const decodePathname = (pathname: string, remaining = 3): string => {
  if (remaining <= 0) return pathname;
  const decoded = decodeOnce(pathname);
  return decoded === pathname
    ? pathname
    : decodePathname(decoded, remaining - 1);
};

/** Canonical browser pathname: readable internally, encoded once in the URL. */
export const canonicalPathname = (pathname: string): string =>
  encodeURI(decodePathname(pathname));

export type NavTarget =
  | { to: '/'; hash?: string }
  | { to: '/map'; hash?: string; search?: MapSearch }
  | { to: '/academic/graduation'; hash?: string; search?: GraduationSearch }
  | { to: '/$'; params: { _splat: string }; hash?: string };

export const toNavTarget = (path: string): NavTarget => {
  const decodedPath = decodePathname(path);
  const hashIndex = decodedPath.indexOf('#');
  const hash =
    hashIndex >= 0 ? decodedPath.slice(hashIndex + 1) || undefined : undefined;
  const hashTarget = hash ? { hash } : {};
  const pathWithoutHash =
    hashIndex >= 0 ? decodedPath.slice(0, hashIndex) : decodedPath;
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
  if (clean === '/academic/graduation') {
    const params = new URLSearchParams(query);
    const search = validateGraduationSearch({
      college: params.get('college'),
      edu: params.get('edu'),
      grade: params.get('grade'),
      cat: params.get('cat'),
    });
    return Object.keys(search).length
      ? { to: '/academic/graduation', search, ...hashTarget }
      : { to: '/academic/graduation', ...hashTarget };
  }
  return {
    to: '/$',
    params: { _splat: clean.replace(/^\//, '') },
    ...hashTarget,
  };
};
