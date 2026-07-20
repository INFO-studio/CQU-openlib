import { describe, expect, it } from 'vite-plus/test';
import { groupCoursesByAlpha, letterOfTitle } from '~/lib/courseAlpha';

describe('letterOfTitle', () => {
  it('maps latin and digits', () => {
    expect(letterOfTitle('Python 入门')).toBe('P');
    expect(letterOfTitle('42 号课程')).toBe('#');
  });

  it('strips decorative prefixes then uses pinyin', () => {
    expect(letterOfTitle('《高等数学》')).toBe('G');
    expect(letterOfTitle('“互联网+”创新')).toBe('H');
  });
});

describe('groupCoursesByAlpha', () => {
  it('groups flat course leaves by letter', () => {
    const groups = groupCoursesByAlpha([
      { title: '高等数学', path: '/course/高等数学' },
      { title: '电路原理', path: '/course/电路原理' },
      {
        title: '通识课',
        path: '/course/通识课',
        children: [{ title: '书法鉴赏', path: '/course/通识课/书法鉴赏' }],
      },
    ]);
    const letters = groups.map((g) => g.letter);
    expect(letters).toContain('G');
    expect(letters).toContain('D');
    expect(letters).toContain('S');
    const g = groups.find((x) => x.letter === 'G');
    expect(g?.items.some((i) => i.title === '高等数学')).toBe(true);
  });
});
