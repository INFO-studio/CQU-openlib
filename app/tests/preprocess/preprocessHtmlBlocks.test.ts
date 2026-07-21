import { describe, expect, it } from 'vite-plus/test';
import preprocess from '~/utils/preprocess';

describe('preprocessHtmlBlocks', () => {
  it('extracts markdown images from single-line figures', () => {
    const input =
      '<figure markdown="span"><div>![preview](/doc/a.svg){.cqu-logo}</div><figcaption>预览</figcaption></figure>';
    expect(preprocess(input)).toBe(
      [
        '![preview](/doc/a.svg){.cqu-logo}',
        '',
        '<p class="docs-figcaption">预览</p>',
        '',
      ].join('\n'),
    );
  });

  it('extracts images from multi-line MkDocs figures (魔法领域)', () => {
    const input = [
      '<figure markdown="span">',
      '![img001](/doc/resources/42_index_001.jpg)',
      '<figcaption>@ 键摄 pixiv: 90724581</figcaption>',
      '</figure>',
    ].join('\n');
    expect(preprocess(input)).toBe(
      [
        '![img001](/doc/resources/42_index_001.jpg)',
        '',
        '<p class="docs-figcaption">@ 键摄 pixiv: 90724581</p>',
        '',
      ].join('\n'),
    );
  });

  it('converts single-line center img tags to markdown', () => {
    const input =
      '<center><img src="/doc/resources/a.png" alt="pic1"></center>';
    expect(preprocess(input)).toBe('![pic1](/doc/resources/a.png)\n');
  });
});
