import { describe, expect, it } from 'vite-plus/test';
import { groupCoursesByAlpha } from '~/lib/courseAlpha';

describe('groupCoursesByAlpha', () => {
  it('groups flat course leaves by letter', () => {
    const groups = groupCoursesByAlpha([
      { title: '高等数学', path: '/course/高等数学', letter: 'G' },
      { title: '电路原理', path: '/course/电路原理', letter: 'D' },
      {
        title: '通识课',
        path: '/course/通识课',
        children: [
          { title: '书法鉴赏', path: '/course/通识课/书法鉴赏', letter: 'S' },
        ],
      },
    ]);
    const letters = groups.map((g) => g.letter);
    expect(letters).toContain('G');
    expect(letters).toContain('D');
    expect(letters).toContain('S');
    const g = groups.find((x) => x.letter === 'G');
    expect(g?.items.some((i) => i.title === '高等数学')).toBe(true);
  });

  it('falls back to # when the build did not attach a letter', () => {
    const groups = groupCoursesByAlpha([
      { title: '未标注课程', path: '/course/未标注课程' },
    ]);
    expect(groups.map((g) => g.letter)).toEqual(['#']);
  });
});
