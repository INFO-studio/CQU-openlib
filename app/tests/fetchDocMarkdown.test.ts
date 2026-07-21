import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { docMarkdownUrls, fetchDocMarkdown } from '~/utils/fetchDocMarkdown';

describe('docMarkdownUrls', () => {
  it('returns index.md for root page', () => {
    expect(docMarkdownUrls('index')).toEqual(['/doc/index.md']);
    expect(docMarkdownUrls('')).toEqual(['/doc/index.md']);
    expect(docMarkdownUrls('///')).toEqual(['/doc/index.md']);
  });

  it('tries folder index then sibling folder.md', () => {
    expect(docMarkdownUrls('sundry/说明书')).toEqual([
      '/doc/sundry/说明书/index.md',
      '/doc/sundry/说明书.md',
    ]);
    expect(docMarkdownUrls('sundry/说明书/')).toEqual([
      '/doc/sundry/说明书/index.md',
      '/doc/sundry/说明书.md',
    ]);
  });
});

describe('fetchDocMarkdown', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

    await expect(fetchDocMarkdown('sundry/说明书')).resolves.toBe('# hi');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/doc/sundry/说明书/index.md',
      '/doc/sundry/说明书.md',
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

    await expect(fetchDocMarkdown('club')).resolves.toBe('# 社团');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/doc/club/index.md',
      '/doc/club.md',
    ]);
  });
});
