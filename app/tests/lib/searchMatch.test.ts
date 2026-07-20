import { describe, expect, it } from 'vite-plus/test';
import { entryMatches, matchScore } from '~/lib/searchMatch';

describe('searchMatch', () => {
  it('matches course codes case-insensitively', () => {
    const entry = {
      title: '高等数学',
      path: '/course/高等数学',
      section: 'course',
      sectionLabel: '课程',
      codes: ['MATH10821', 'MATH10822'],
    };
    expect(entryMatches(entry, 'math10821')).toBe(true);
    expect(matchScore(entry, 'MATH10821')).toBe(0);
    expect(matchScore(entry, 'MATH')).toBe(1);
  });
});
