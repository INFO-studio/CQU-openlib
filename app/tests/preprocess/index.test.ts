import { describe, expect, it } from 'vite-plus/test';
import { ADMONITION_END, ADMONITION_START } from '~/consts/placeholders';
import preprocess from '~/utils/preprocess';

describe('preprocess', () => {
  it('normalizes CRLF and fences admonition bodies without TAB markers', () => {
    const input = '!!! note "t"\r\n    body\r\nnext';
    expect(preprocess(input)).toBe(
      [
        ADMONITION_START,
        '!!! note "t"',
        '',
        'body',
        ADMONITION_END,
        'next',
      ].join('\n'),
    );
  });

  it('preserves nested list indentation outside admonitions', () => {
    const input = ['* a', '    * b', '        * c', ''].join('\n');
    expect(preprocess(input)).toBe(input);
  });

  it('preserves nested lists inside admonition bodies (after one un-indent)', () => {
    const input = ['!!! tip "t"', '    * a', '        * b', 'outside'].join(
      '\n',
    );
    expect(preprocess(input)).toBe(
      [
        ADMONITION_START,
        '!!! tip "t"',
        '',
        '* a',
        '    * b',
        ADMONITION_END,
        'outside',
      ].join('\n'),
    );
  });
});
