import { cleanPath, decodePathname } from '~/lib/paths';
export const normalizeDocHref = (href: string): string => {
  if (!href) return href;
  if (
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    return href;
  }
  const match = href.match(/^([^?#]*)([?#].*)?$/);
  const suffix = match?.[2] ?? '';
  const stripped = (match?.[1] ?? href).replace(/\.mdx?$/i, '');
  const path =
    stripped === 'index' || stripped === './index' || stripped === '/index'
      ? stripped.startsWith('/')
        ? '/'
        : './'
      : stripped.endsWith('/index')
        ? stripped.slice(0, -'index'.length)
        : stripped;
  return `${path}${suffix}`;
};
export const resolveDocHref = (href: string, baseDir: string): string => {
  const normalized = normalizeDocHref(href);
  if (!normalized) return normalized;
  if (
    normalized.startsWith('#') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('tel:') ||
    normalized.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    return normalized;
  }
  if (normalized.startsWith('/')) {
    return cleanPath(normalized);
  }
  const base =
    !baseDir || baseDir === '/' ? '/' : `${baseDir.replace(/\/+$/, '')}/`;
  try {
    const url = new URL(normalized, `https://doc.local${base}`);
    return cleanPath(decodePathname(url.pathname));
  } catch {
    return cleanPath(`/${normalized}`);
  }
};
/**
 * Directory used to resolve relative markdown links/images.
 * Derived from the on-disk doc URL that actually loaded:
 * - `/doc/foo/bar/index.md` → `/foo/bar` (folder index)
 * - `/doc/foo/bar.md` → `/foo` (leaf page; `../` climbs from the parent)
 */
export const baseDirFromDocUrl = (docUrl: string): string => {
  const withoutPrefix = docUrl.replace(/^\/doc\/?/, '');
  const path = withoutPrefix.replace(/\.mdx?$/i, '');
  if (!path || path === 'index') return '/';
  if (path.endsWith('/index')) {
    return cleanPath(`/${path.slice(0, -'/index'.length)}`);
  }
  const slash = path.lastIndexOf('/');
  if (slash === -1) return '/';
  return cleanPath(`/${path.slice(0, slash)}`);
};
