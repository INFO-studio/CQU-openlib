import { describe, expect, it } from 'vite-plus/test';
import { toNavTarget } from '~/lib/paths';

describe('toNavTarget', () => {
  it('keeps app routes out of the markdown catch-all', () => {
    expect(toNavTarget('/map')).toEqual({ to: '/map' });
    expect(toNavTarget('/map/')).toEqual({ to: '/map' });
  });

  it('continues routing document paths through the splat route', () => {
    expect(toNavTarget('/course/高等数学')).toEqual({
      to: '/$',
      params: { _splat: 'course/高等数学' },
    });
  });
});
