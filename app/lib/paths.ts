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
    }
  | {
      to: '/map';
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
    };
export const toNavTarget = (path: string): NavTarget => {
  const [pathWithHash, query = ''] = path.split('?', 2);
  const clean = cleanPath(pathWithHash.split('#', 1)[0]);
  if (clean === '/') return { to: '/' };
  if (clean === '/map') {
    const params = new URLSearchParams(query.split('#', 1)[0]);
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
      ? { to: '/map', search }
      : { to: '/map' };
  }
  return {
    to: '/$',
    params: { _splat: clean.replace(/^\//, '') },
  };
};
