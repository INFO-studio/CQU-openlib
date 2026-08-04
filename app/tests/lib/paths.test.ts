import { describe, expect, it } from 'vite-plus/test';
import { toNavTarget } from '~/lib/paths';

describe('toNavTarget', () => {
  it('keeps app routes out of the markdown catch-all', () => {
    expect(toNavTarget('/map')).toEqual({ to: '/map' });
    expect(toNavTarget('/map/')).toEqual({ to: '/map' });
    expect(toNavTarget('/map?campus=d')).toEqual({
      to: '/map',
      search: { campus: 'd', focus: undefined },
    });
    expect(toNavTarget('/map?campus=a&focus=a-library')).toEqual({
      to: '/map',
      search: { campus: 'a', focus: 'a-library' },
    });
    expect(toNavTarget('/map?campus=d#交通')).toEqual({
      to: '/map',
      search: { campus: 'd', focus: undefined },
      hash: '交通',
    });
    expect(toNavTarget('/map?campus=invalid')).toEqual({ to: '/map' });
  });

  it('continues routing document paths through the splat route', () => {
    expect(toNavTarget('/course/高等数学')).toEqual({
      to: '/$',
      params: { _splat: 'course/高等数学' },
    });
    expect(toNavTarget('/academic/入学必看/常见问题#校园卡是什么')).toEqual({
      to: '/$',
      params: { _splat: 'academic/入学必看/常见问题' },
      hash: '校园卡是什么',
    });
  });
});
