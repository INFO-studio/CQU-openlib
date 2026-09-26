import { describe, expect, it } from 'vite-plus/test';
import { renderRouteHtml } from '../../vite/docSeo';

const template = `<!doctype html>
<html>
  <head>
    <meta name="description" content="default" />
    <title>CQU-openlib</title>
  </head>
  <body></body>
</html>`;

describe('document SEO shell', () => {
  it('renders route-specific title, description, canonical and social metadata', () => {
    const html = renderRouteHtml(template, {
      path: '/course/高等数学',
      title: '高等数学',
      description: '高等数学课程资料。',
    });
    expect(html).toContain('<title>高等数学 · CQU-openlib</title>');
    expect(html).toContain('content="高等数学课程资料。"');
    expect(html).toContain(
      'href="https://cqu-openlib.cn/course/%E9%AB%98%E7%AD%89%E6%95%B0%E5%AD%A6"',
    );
    expect(html).toContain('property="og:title"');
    expect(html).toContain('content="index, follow"');
  });

  it('marks private utility shells as noindex', () => {
    const html = renderRouteHtml(template, {
      path: '/admin',
      title: '维护台',
      description: '维护台。',
      noindex: true,
    });
    expect(html).toContain('content="noindex, nofollow"');
  });
});
