import { describe, expect, it } from 'vite-plus/test';
import { letterOfTitle } from '../../../vite/courseLetter';

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
