import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { docMarkdownUrls, fetchDocMarkdown } from '~/utils/fetchDocMarkdown';

describe('docMarkdownUrls', () => {
  it('returns index.md for root page', () => {
    expect(docMarkdownUrls('index')).toEqual(['/doc/index.md']);
    expect(docMarkdownUrls('')).toEqual(['/doc/index.md']);
    expect(docMarkdownUrls('///')).toEqual(['/doc/index.md']);
  });

  it('tries flat file then folder index', () => {
    expect(docMarkdownUrls('sundry/说明书')).toEqual([
      '/doc/sundry/说明书.md',
      '/doc/sundry/说明书/index.md',
    ]);
    expect(docMarkdownUrls('sundry/说明书/')).toEqual([
      '/doc/sundry/说明书.md',
      '/doc/sundry/说明书/index.md',
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips html SPA fallback responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    );

    await expect(fetchDocMarkdown('missing')).resolves.toBeNull();
  });
});
