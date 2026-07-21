/** Candidate static URLs for a clean page path (folder → index.md). */
export const docMarkdownUrls = (page: string): string[] => {
  const normalized = page.replace(/\/+$/, '') || 'index';
  if (normalized === 'index') return ['/doc/index.md'];
  // Prefer …/index.md (MkDocs layout on disk), then sibling folder.md.
  return [`/doc/${normalized}/index.md`, `/doc/${normalized}.md`];
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
): Promise<string | null> => {
  for (const url of docMarkdownUrls(page)) {
    const response = await fetch(url);
    const text = await response.text();
    if (!isUsableMarkdown(response, text)) continue;
    return text;
  }
  return null;
};
