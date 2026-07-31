import { describe, expect, it } from 'vite-plus/test';
import { compareTitles, significantTitle } from '~/lib/titleOrder';

const sorted = (titles: string[]) => [...titles].sort(compareTitles);

describe('significantTitle', () => {
  it('drops decoration anywhere in the title', () => {
    expect(significantTitle('《热能存储技术与应用》课程设计')).toBe(
      '热能存储技术与应用课程设计',
    );
    expect(significantTitle('“互联网+”创新')).toBe('互联网创新');
    expect(significantTitle('Independent  Study独立研究')).toBe(
      'IndependentStudy独立研究',
    );
  });

  it('keeps the raw title when nothing significant is left', () => {
    expect(significantTitle('——')).toBe('——');
  });
});

describe('compareTitles', () => {
  it('ignores decoration instead of sorting on it', () => {
    expect(
      sorted(['燃料电池', '《热能存储技术与应用》课程设计', '燃气安全技术']),
    ).toEqual(['燃料电池', '燃气安全技术', '《热能存储技术与应用》课程设计']);
  });

  it('puts latin titles ahead of chinese ones', () => {
    expect(
      sorted(['长片剧本写作', 'CAD案例设计与实践', '材料表面工程']),
    ).toEqual(['CAD案例设计与实践', '材料表面工程', '长片剧本写作']);
  });

  it('orders titles that differ only in punctuation deterministically', () => {
    expect(sorted(['C程序设计技术', 'C++程序设计技术'])).toEqual([
      'C++程序设计技术',
      'C程序设计技术',
    ]);
  });
});
