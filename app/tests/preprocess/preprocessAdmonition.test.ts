import { describe, expect, it } from 'vite-plus/test';
import { ADMONITION_END, ADMONITION_START } from '~/consts/placeholders';
import preprocessAdmonition from '~/utils/preprocess/preprocessAdmonition';

describe('preprocessAdmonition', () => {
  it('wraps admonition blocks and un-indents 4-space bodies', () => {
    expect(
      preprocessAdmonition(['before', '!!! note "标题"', '    body', 'after']),
    ).toEqual([
      'before',
      ADMONITION_START,
      '!!! note "标题"',
      '',
      'body',
      ADMONITION_END,
      'after',
    ]);
  });

  it('keeps an indented head inside its list item', () => {
    expect(
      preprocessAdmonition([
        '- 列表项',
        '',
        '    !!! warning "注意"',
        '        正文',
        '- 下一项',
      ]),
    ).toEqual([
      '- 列表项',
      '',
      `    ${ADMONITION_START}`,
      '    !!! warning "注意"',
      '',
      '    正文',
      `    ${ADMONITION_END}`,
      '- 下一项',
    ]);
  });

  it('closes an open admonition at EOF', () => {
    expect(preprocessAdmonition(['!!! tip "t"', '    still open'])).toEqual([
      ADMONITION_START,
      '!!! tip "t"',
      '',
      'still open',
      ADMONITION_END,
    ]);
  });

  it('ignores non-admonition bang lines', () => {
    expect(preprocessAdmonition(['!!!', 'not a head'])).toEqual([
      '!!!',
      'not a head',
    ]);
  });

  it('re-opens when a title-only admonition is followed by another head', () => {
    expect(
      preprocessAdmonition([
        '!!! quote "恰同学少年"',
        '',
        '!!! info "联系方式"',
        '    * 群号',
        '## next',
      ]),
    ).toEqual([
      ADMONITION_START,
      '!!! quote "恰同学少年"',
      '',
      '', // source blank + synthetic blank after head
      ADMONITION_END,
      ADMONITION_START,
      '!!! info "联系方式"',
      '',
      '* 群号',
      ADMONITION_END,
      '## next',
    ]);
  });
});
