export const docMarkdownUrls = (page: string): string[] => {
  const normalized = page.replace(/\/+$/, '') || 'index';
  if (normalized === 'index') return ['/doc/index.md'];
  return [`/doc/${normalized}.md`, `/doc/${normalized}/index.md`];
};
const isHtmlResponse = (res: Response): boolean => {
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('text/html');
};
export const fetchDocMarkdown = async (
  page: string,
): Promise<string | null> => {
  for (const url of docMarkdownUrls(page)) {
    const res = await fetch(url);
    if (!res.ok || isHtmlResponse(res)) continue;
    return res.text();
  }
  return null;
};
