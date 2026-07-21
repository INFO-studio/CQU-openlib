/** Candidate static URLs for a clean page path (folder → index.md). */
export const docMarkdownUrls = (page: string): string[] => {
  const normalized = page.replace(/\/+$/, '') || 'index';
  if (normalized === 'index') return ['/doc/index.md'];
  return [`/doc/${normalized}.md`, `/doc/${normalized}/index.md`];
};

const isHtmlResponse = (res: Response): boolean => {
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('text/html');
};

/** SPA hosts may rewrite missing `*.md` to index.html but keep a markdown Content-Type. */
const looksLikeHtml = (text: string): boolean => {
  const head = text.slice(0, 256).trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
};

/** Fetch markdown for a page path, falling back to `…/index.md` for folders. */
export const fetchDocMarkdown = async (
  page: string,
): Promise<string | null> => {
  for (const url of docMarkdownUrls(page)) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const text = await res.text();
    if (isHtmlResponse(res) || looksLikeHtml(text)) continue;
    return text;
  }
  return null;
};
