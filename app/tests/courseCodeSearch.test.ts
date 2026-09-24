import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  courseCodeBucket,
  isCourseCodeQuery,
  normalizeCourseCode,
} from '~/lib/courseCodeSearch';
import { findExactCourseCodes } from '~/queries/search';

describe('course code search', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes case and maps equivalent codes to one stable bucket', () => {
    expect(normalizeCourseCode(' MATH10821 ')).toBe('math10821');
    expect(courseCodeBucket('MATH10821')).toBe(courseCodeBucket('math10821'));
  });

  it('downloads one deterministic chunk and returns exact entries case-insensitively', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            math10821: [
              {
                title: '高等数学',
                path: '/course/高等数学',
                section: '课程',
                codes: ['MATH10821'],
              },
            ],
          }),
        ),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(findExactCourseCodes('math10821')).resolves.toEqual([
      expect.objectContaining({ title: '高等数学', path: '/course/高等数学' }),
    ]);
    expect(fetch).toHaveBeenCalledWith(
      `/search/codes/${courseCodeBucket('math10821')}.json`,
    );
  });

  it('only treats complete alpha-numeric course codes as exact lookups', () => {
    expect(isCourseCodeQuery('MATH10821')).toBe(true);
    expect(isCourseCodeQuery('b2')).toBe(true);
    expect(isCourseCodeQuery('高等数学')).toBe(false);
    expect(isCourseCodeQuery('MATH')).toBe(true);
    expect(isCourseCodeQuery('10821')).toBe(true);
    expect(isCourseCodeQuery('MATH 10821')).toBe(false);
  });
});
