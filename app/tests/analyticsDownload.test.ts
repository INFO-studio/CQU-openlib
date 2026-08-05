import { describe, expect, it } from 'vite-plus/test';
import { classifyDownload } from '~/lib/analyticsDownload';

describe('classifyDownload — the /file redirect', () => {
  it('pulls out the key, which is how a resource is identified', () => {
    expect(
      classifyDownload('https://api.cqu-openlib.cn/file?key=iPdc41ximgij'),
    ).toEqual({
      kind: 'file',
      href: 'https://api.cqu-openlib.cn/file?key=iPdc41ximgij',
      file_key: 'iPdc41ximgij',
    });
  });

  it('still counts the click when the key is missing', () => {
    expect(classifyDownload('https://api.cqu-openlib.cn/file')).toEqual({
      kind: 'file',
      href: 'https://api.cqu-openlib.cn/file',
    });
  });

  it('is not fooled by a lookalike host', () => {
    expect(classifyDownload('https://evil.example/file?key=x')).toBeNull();
  });
});

describe('classifyDownload — files served by this site', () => {
  it('counts anything under /doc/', () => {
    expect(classifyDownload('/doc/academic/校徽_蓝色.svg')).toEqual({
      kind: 'asset',
      href: '/doc/academic/校徽_蓝色.svg',
    });
  });

  it('counts a local link carrying a download attribute', () => {
    expect(classifyDownload('/files/handbook', true)).toEqual({
      kind: 'asset',
      href: '/files/handbook',
    });
  });

  it('counts a local path by its extension alone', () => {
    expect(classifyDownload('/static/guide.pdf')).toEqual({
      kind: 'asset',
      href: '/static/guide.pdf',
    });
  });

  it('looks past a query string when reading the extension', () => {
    expect(classifyDownload('/static/guide.pdf?v=2')?.kind).toBe('asset');
  });
});

describe('classifyDownload — files hosted elsewhere', () => {
  it('counts an external document link', () => {
    expect(classifyDownload('https://example.com/paper.pdf')).toEqual({
      kind: 'ext',
      href: 'https://example.com/paper.pdf',
    });
  });

  it('counts an external link marked as a download', () => {
    expect(classifyDownload('https://example.com/get', true)?.kind).toBe('ext');
  });
});

describe('classifyDownload — ordinary hyperlinks stay untracked', () => {
  it('ignores repos, videos, portals, mail, anchors and doc pages', () => {
    const plain = [
      'https://github.com/INFO-studio/CQU-openlib',
      'https://www.bilibili.com/video/BV1',
      'https://my.cqu.edu.cn',
      'mailto:contact@cqu-openlib.cn',
      '#section',
      '/course/高等数学',
      '',
    ];
    for (const href of plain) {
      expect(classifyDownload(href), href).toBeNull();
    }
  });
});
