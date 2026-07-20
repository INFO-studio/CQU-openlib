import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

describe('course-codes metadata', () => {
  it('maps MATH10821 to 高等数学', () => {
    const raw = JSON.parse(
      readFileSync(resolve('public/metadata/course-codes.json'), 'utf8'),
    ) as {
      byCode: Record<string, string>;
      courses: Record<string, { codes: string[] }>;
    };
    expect(raw.byCode.MATH10821).toBe('/course/高等数学');
    expect(raw.courses['/course/高等数学']?.codes).toContain('MATH10821');
  });
});
