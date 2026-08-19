import { describe, expect, it } from 'vite-plus/test';
import { formatTitle } from '~/hooks/useTitle';

describe('formatTitle', () => {
  it('adds the site suffix to page titles', () => {
    expect(formatTitle('校园地图')).toBe('校园地图 · CQU-openlib');
  });

  it('keeps the home and site titles canonical', () => {
    expect(formatTitle('首页')).toBe('CQU-openlib');
    expect(formatTitle('CQU-openlib')).toBe('CQU-openlib');
  });
});
