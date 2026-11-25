import { describe, expect, it } from 'vite-plus/test';
import {
  createZhVocabulary,
  parseZhVocabulary,
  segmentZhText,
} from '~/lib/zhSegment';

describe('zhSegment', () => {
  const vocab = createZhVocabulary([
    '户外',
    '素质',
    '拓展',
    '协会',
    '微积分',
    '大学',
    '物理',
    '化工',
    '课程',
    '打印',
    '程序设计',
    '程序',
    '设计',
  ]);

  it('segments multi-word Chinese queries deterministically', () => {
    expect(segmentZhText('户外素质', vocab)).toBe('户外 素质');
    expect(segmentZhText('户外素质拓展协会', vocab)).toBe(
      '户外 素质 拓展 协会',
    );
  });

  it('prefers the longest matching word in vocabulary', () => {
    expect(segmentZhText('程序设计', vocab)).toBe('程序设计');
  });

  it('keeps trailing prefixes of longer vocabulary words intact', () => {
    expect(segmentZhText('微积', vocab)).toBe('微积');
    expect(segmentZhText('大学微积', vocab)).toBe('大学 微积');
  });

  it('handles mixed ASCII, punctuation, and plain ASCII queries', () => {
    expect(segmentZhText('3D打印', vocab)).toBe('3D 打印');
    expect(segmentZhText('课程A', vocab)).toBe('课程 A');
    expect(segmentZhText('B1', vocab)).toBe('B1');
    expect(segmentZhText('大学物理（化工类）', vocab)).toBe(
      '大学 物理 （ 化工 类 ）',
    );
  });

  it('parses newline-delimited vocabularies and falls back when empty', () => {
    const parsed = parseZhVocabulary('户外\n素质\n\n单\n');
    expect(parsed.words.has('单')).toBe(false);
    expect(segmentZhText('户外素质', parsed)).toBe('户外 素质');
    expect(segmentZhText(' 户外素质 ', createZhVocabulary([]))).toBe(
      '户外素质',
    );
  });
});
