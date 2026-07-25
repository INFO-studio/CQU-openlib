import { baseDirFromDocUrl } from '~/utils/normalizeDocHref';
// Written by vite/doc-nav-index on every build; see vite/doc-markdown.
import folderPages from '../../metadata/doc-folder-pages.json';

const FOLDER_PAGES = new Set<string>(folderPages);

/**
 * Candidate static URLs for a clean page path, best guess first.
 *
 * A page in FOLDER_PAGES resolves in one request. A miss keeps the
 * `<page>/index.md` fallback: absence from the set is weaker evidence than
 * presence (a path that failed to match, e.g. over Unicode normalisation,
 * lands here), and the fallback costs nothing when the leaf URL hits.
 */
export const docMarkdownUrls = (page: string): string[] => {
  const normalized = page.replace(/\/+$/, '') || 'index';
  if (normalized === 'index') return ['/doc/index.md'];
  if (FOLDER_PAGES.has(normalized)) return [`/doc/${normalized}/index.md`];
  return [`/doc/${normalized}.md`, `/doc/${normalized}/index.md`];
};

export type FetchedDoc = {
  markdown: string;
  /** Base directory for relative link resolution (MkDocs semantics). */
  baseDir: string;
};

const isHtmlResponse = (res: Response): boolean => {
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('text/html');
};

/**
 * SPA hosts may rewrite missing `*.md` to index.html but keep a markdown
 * Content-Type — Firefox then shows the shell source as "document text".
 */
const looksLikeHtml = (text: string): boolean => {
  const head = text.slice(0, 256).trimStart().toLowerCase();
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<head') ||
    head.startsWith('<script')
  );
};

/** Reject SPA / placeholder bodies even when status is 200. */
const isUsableMarkdown = (res: Response, text: string): boolean => {
  if (!res.ok) return false;
  if (isHtmlResponse(res) || looksLikeHtml(text)) return false;
  // Netlify dedicated doc 404 body (see public/doc-not-found.txt).
  if (text.trim() === 'NOT_FOUND') return false;
  return true;
};

/** Fetch markdown for a page path, falling back across index.md / folder.md. */
export const fetchDocMarkdown = async (
  page: string,
): Promise<FetchedDoc | null> => {
  for (const url of docMarkdownUrls(page)) {
    const response = await fetch(url);
    const text = await response.text();
    if (!isUsableMarkdown(response, text)) continue;
    return { markdown: text, baseDir: baseDirFromDocUrl(url) };
  }
  return null;
};
