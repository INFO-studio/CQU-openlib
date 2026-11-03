import { describe, expect, it } from 'vite-plus/test';
import { courseLetter, letterOfTitle } from '../../../vite/courseLetter';

describe('letterOfTitle', () => {
  it('maps latin and digits', () => {
    expect(letterOfTitle('Python 入门')).toBe('P');
    expect(letterOfTitle('42 号课程')).toBe('#');
  });

  it('strips decorative prefixes then uses pinyin', () => {
    expect(letterOfTitle('《高等数学》')).toBe('G');
    expect(letterOfTitle('“互联网+”创新')).toBe('H');
  });

  it('uses a frontmatter letter only when it is A-Z or #', () => {
    const page = (letter: string) =>
      `---\nplaceholder: course\nletter: ${letter}\n---\n`;
    expect(courseLetter('重庆文学专题研读', page('Z'))).toBe('Z');
    expect(courseLetter('高等数学', page("'#'"))).toBe('#');
    expect(courseLetter('高等数学', page('重庆'))).toBe('G');
    expect(courseLetter('高等数学', page('ZZ'))).toBe('G');
    expect(courseLetter('重庆文学专题研读')).toBe('Z');
  });
});
