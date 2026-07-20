import { describe, expect, it } from 'vite-plus/test';
import { normalizeDocHref, resolveDocHref } from '~/utils/normalizeDocHref';

describe('normalizeDocHref', () => {
  it('strips .md / .mdx and keeps hash/query', () => {
    expect(normalizeDocHref('foo.md')).toBe('foo');
    expect(normalizeDocHref('./bar.mdx#x')).toBe('./bar#x');
    expect(normalizeDocHref('/course/foo.md?q=1')).toBe('/course/foo?q=1');
  });

  it('maps index links to the parent folder', () => {
    expect(normalizeDocHref('index.md')).toBe('./');
    expect(normalizeDocHref('./index.md')).toBe('./');
    expect(normalizeDocHref('/index.md')).toBe('/');
    expect(normalizeDocHref('/course/index.md')).toBe('/course/');
    expect(normalizeDocHref('../index.md')).toBe('../');
  });

  it('leaves external and special schemes alone', () => {
    expect(normalizeDocHref('https://a.com/x.md')).toBe('https://a.com/x.md');
    expect(normalizeDocHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(normalizeDocHref('tel:123')).toBe('tel:123');
    expect(normalizeDocHref('//cdn.example/x.md')).toBe('//cdn.example/x.md');
    expect(normalizeDocHref('#anchor')).toBe('#anchor');
  });

  it('handles empty input', () => {
    expect(normalizeDocHref('')).toBe('');
  });
});

describe('resolveDocHref', () => {
  it('resolves relative index links against the current doc directory', () => {
    expect(resolveDocHref('入学必看/index.md', '/academic')).toBe(
      '/academic/入学必看',
    );
    expect(resolveDocHref('academic/入学必看/index.md', '/')).toBe(
      '/academic/入学必看',
    );
    expect(resolveDocHref('../contributor/茵符草.md', '/academic')).toBe(
      '/contributor/茵符草',
    );
  });

  it('keeps absolute and external hrefs', () => {
    expect(resolveDocHref('/course/foo.md', '/academic')).toBe('/course/foo');
    expect(resolveDocHref('https://a.com/x.md', '/academic')).toBe(
      'https://a.com/x.md',
    );
  });
});
