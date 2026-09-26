import { useEffect } from 'react';
import { canonicalUrl, defaultDescription, formatTitle } from '~/lib/pageMeta';
import { decodePathname } from '~/lib/paths';

export { formatTitle } from '~/lib/pageMeta';

const metaElement = (selector: string): HTMLMetaElement => {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) return existing;
  const created = document.createElement('meta');
  const matched = selector.match(/meta\[([^=]+)="([^"]+)"\]/);
  if (matched) created.setAttribute(matched[1]!, matched[2]!);
  document.head.appendChild(created);
  return created;
};

const setMeta = (selector: string, attribute: string, value: string) => {
  metaElement(selector).setAttribute(attribute, value);
};

const canonicalElement = (): HTMLLinkElement => {
  const existing = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (existing) return existing;
  const created = document.createElement('link');
  created.rel = 'canonical';
  document.head.appendChild(created);
  return created;
};

const setCanonical = (href: string) => {
  canonicalElement().href = href;
};

export const useTitle = (
  title: string | null | undefined,
  description?: string,
): void => {
  const pathname =
    typeof window === 'undefined'
      ? '/'
      : decodePathname(window.location.pathname);
  useEffect(() => {
    if (title === undefined) return;
    const formatted = formatTitle(title);
    const resolvedDescription = description ?? defaultDescription(title);
    const canonical = canonicalUrl(pathname);
    document.title = formatted;
    setMeta('meta[name="description"]', 'content', resolvedDescription);
    setMeta('meta[property="og:title"]', 'content', formatted);
    setMeta('meta[property="og:description"]', 'content', resolvedDescription);
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[name="twitter:card"]', 'content', 'summary');
    setCanonical(canonical);
  }, [description, pathname, title]);
};
