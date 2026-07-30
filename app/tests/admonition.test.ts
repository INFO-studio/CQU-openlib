import { describe, expect, it } from 'vite-plus/test';
import { collapseFromMarker, isValidAdmonitionType } from '~/utils/admonition';

describe('admonition helpers', () => {
  it('accepts known types only', () => {
    expect(isValidAdmonitionType('example')).toBe(true);
    expect(isValidAdmonitionType('nope')).toBe(false);
  });

  it('maps Material markers to collapse state', () => {
    expect(collapseFromMarker('!!!')).toBeUndefined();
    expect(collapseFromMarker('???')).toBe('closed');
    expect(collapseFromMarker('???+')).toBe('open');
  });
});
