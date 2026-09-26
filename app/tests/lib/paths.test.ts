import { defaultStringifySearch } from '@tanstack/react-router';
import { describe, expect, it } from 'vite-plus/test';
import { canonicalPathname, decodePathname, toNavTarget } from '~/lib/paths';

describe('toNavTarget', () => {
  it('keeps app routes out of the markdown catch-all', () => {
    expect(toNavTarget('/map')).toEqual({ to: '/map' });
    expect(toNavTarget('/map/')).toEqual({ to: '/map' });
    expect(toNavTarget('/map?campus=d')).toEqual({
      to: '/map',
      search: { campus: 'd' },
    });
    expect(toNavTarget('/map?campus=a&focus=a-library')).toEqual({
      to: '/map',
      search: { campus: 'a', focus: 'a-library' },
    });
    expect(toNavTarget('/map?campus=a&filter=library')).toEqual({
      to: '/map',
      search: { campus: 'a', filter: 'library' },
    });
    expect(toNavTarget('/map?campus=d#交通')).toEqual({
      to: '/map',
      search: { campus: 'd' },
      hash: '交通',
    });
    expect(toNavTarget('/map?campus=invalid')).toEqual({ to: '/map' });
    expect(toNavTarget('/map?filter=all')).toEqual({ to: '/map' });
  });

  it('keeps map URL keys in campus-filter-focus order', () => {
    const target = toNavTarget('/map?focus=a_library&filter=library&campus=a');
    if (target.to !== '/map') throw new Error('expected map target');
    expect(defaultStringifySearch(target.search ?? {})).toBe(
      '?campus=a&filter=library&focus=a_library',
    );
  });

  it('keeps the graduation page out of the splat despite sitting under a doc section', () => {
    expect(toNavTarget('/academic/graduation')).toEqual({
      to: '/academic/graduation',
    });
    expect(toNavTarget('/academic/graduation/')).toEqual({
      to: '/academic/graduation',
    });
    expect(toNavTarget('/academic/graduation?college=128&edu=本科')).toEqual({
      to: '/academic/graduation',
      search: { college: '128', edu: '本科' },
    });
    expect(toNavTarget('/academic/graduation?grade=2023&cat=就业')).toEqual({
      to: '/academic/graduation',
      search: { grade: 2023, cat: '就业' },
    });
    expect(toNavTarget('/academic/graduation?grade=abc')).toEqual({
      to: '/academic/graduation',
    });
  });

  it('normalizes repeatedly encoded document paths and hashes', () => {
    const malformed =
      '/skill/%25E8%25BD%25AF%25E4%25BB%25B6#6-%25E5%2585%25A8%25E9%2583%25A8';
    expect(decodePathname(malformed)).toBe('/skill/软件#6-全部');
    expect(canonicalPathname(malformed)).toBe(
      '/skill/%E8%BD%AF%E4%BB%B6#6-%E5%85%A8%E9%83%A8',
    );
    expect(toNavTarget(malformed)).toEqual({
      to: '/$',
      params: { _splat: 'skill/软件' },
      hash: '6-全部',
    });
  });

  it('continues routing document paths through the splat route', () => {
    expect(toNavTarget('/course/高等数学')).toEqual({
      to: '/$',
      params: { _splat: 'course/高等数学' },
    });
    expect(toNavTarget('/academic/graduation-notes')).toEqual({
      to: '/$',
      params: { _splat: 'academic/graduation-notes' },
    });
    expect(toNavTarget('/academic/入学必看/常见问题#校园卡是什么')).toEqual({
      to: '/$',
      params: { _splat: 'academic/入学必看/常见问题' },
      hash: '校园卡是什么',
    });
  });
});
