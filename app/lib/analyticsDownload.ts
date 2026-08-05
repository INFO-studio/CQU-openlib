import { API_BASE } from '~/lib/apiBase';

/**
 * How a download reached the reader.
 *
 * - `file`  — our `/file?key=` redirect, which fronts the shared drive
 * - `asset` — a file served from this site (`/doc/**` or an explicit download)
 * - `ext`   — a document hosted somewhere else
 */
export type DownloadKind = 'file' | 'asset' | 'ext';

export type DownloadInfo = {
  kind: DownloadKind;
  href: string;
  /** Only for `file`: the key identifying the stored object. */
  file_key?: string;
};

const FILE_ENDPOINT = `${API_BASE}/file`;

const FILE_EXTENSION =
  /\.(?:pdf|zip|rar|7z|docx?|xlsx?|pptx?|txt|csv|mp[34]|wav|svg|png|jpe?g|gif|webp)$/i;

const fileKeyOf = (href: string): string | null => {
  const [base, query = ''] = href.split('?', 2);
  if (base?.toLowerCase() !== FILE_ENDPOINT.toLowerCase()) return null;
  return new URLSearchParams(query).get('key');
};

/**
 * Decides whether a link click is worth recording as a download.
 *
 * Ordinary hyperlinks — a GitHub repo, a Bilibili video, a university notice —
 * return `null`. Only links that hand the reader a file are counted, because
 * "which material did people actually take" is the question this answers.
 */
export const classifyDownload = (
  href: string,
  hasDownloadAttr = false,
): DownloadInfo | null => {
  if (!href) return null;

  const key = fileKeyOf(href);
  if (key !== null) return { kind: 'file', href, file_key: key };
  if (href.toLowerCase().startsWith(FILE_ENDPOINT.toLowerCase())) {
    return { kind: 'file', href };
  }

  const external = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
  if (href.startsWith('/doc/')) return { kind: 'asset', href };
  if (hasDownloadAttr && !external) return { kind: 'asset', href };

  const path = href.split(/[?#]/)[0] ?? '';
  if (FILE_EXTENSION.test(path)) {
    return { kind: external ? 'ext' : 'asset', href };
  }

  return hasDownloadAttr && external ? { kind: 'ext', href } : null;
};
