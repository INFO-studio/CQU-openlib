import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { docMarkdownUrls, fetchDocMarkdown } from '~/utils/fetchDocMarkdown';

// `academic` is a real folder page (public/doc/academic/index.md); the
// `未收录` paths are deliberately absent so they exercise the leaf branch.
describe('docMarkdownUrls', () => {
  it('returns index.md for root page', () => {
    expect(docMarkdownUrls('index')).toEqual(['/doc/index.md']);
    expect(docMarkdownUrls('')).toEqual(['/doc/index.md']);
    expect(docMarkdownUrls('///')).toEqual(['/doc/index.md']);
  });

  it('asks only for index.md when the page is a known folder', () => {
    expect(docMarkdownUrls('academic')).toEqual(['/doc/academic/index.md']);
    expect(docMarkdownUrls('academic/')).toEqual(['/doc/academic/index.md']);
    expect(docMarkdownUrls('sundry/说明书')).toEqual([
      '/doc/sundry/说明书/index.md',
    ]);
  });

  it('prefers the leaf file otherwise, keeping index.md as a fallback', () => {
    expect(docMarkdownUrls('sundry/未收录')).toEqual([
      '/doc/sundry/未收录.md',
      '/doc/sundry/未收录/index.md',
    ]);
  });
});

describe('fetchDocMarkdown', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches a folder page in a single request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('# index', {
        status: 200,
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDocMarkdown('academic')).resolves.toEqual({
      markdown: '# index',
      baseDir: '/academic',
    });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/doc/academic/index.md',
    ]);
  });

  it('returns the first successful non-html response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 404,
          headers: { 'content-type': 'text/plain' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('# hi', {
          status: 200,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDocMarkdown('sundry/未收录')).resolves.toEqual({
      markdown: '# hi',
      baseDir: '/sundry/未收录',
    });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/doc/sundry/未收录.md',
      '/doc/sundry/未收录/index.md',
    ]);
  });

  it('skips html SPA fallback responses', async () => {
    // Fresh Response per call: `missing` tries two URLs and must not reuse one body.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response('<html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
      ),
    );

    await expect(fetchDocMarkdown('missing')).resolves.toBeNull();
  });

  it('skips SPA HTML that is mislabeled as markdown (Netlify rewrite)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<!doctype html><html lang="zh-CN"></html>', {
          status: 200,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('# 社团', {
          status: 200,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDocMarkdown('life/未收录')).resolves.toEqual({
      markdown: '# 社团',
      baseDir: '/life/未收录',
    });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/doc/life/未收录.md',
      '/doc/life/未收录/index.md',
    ]);
  });
});
