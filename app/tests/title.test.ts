import { describe, expect, it } from 'vite-plus/test';
import { formatTitle } from '~/hooks/useTitle';

describe('formatTitle', () => {
  it('adds the site suffix to page titles', () => {
    expect(formatTitle('校园地图')).toBe('校园地图 · CQU-openlib');
  });

  it('does not guess which page is the homepage', () => {
    expect(formatTitle('欢迎')).toBe('欢迎 · CQU-openlib');
    expect(formatTitle('首页')).toBe('首页 · CQU-openlib');
  });

  it('uses the canonical site title only when explicitly requested', () => {
    expect(formatTitle(null)).toBe('CQU-openlib');
  });
});
