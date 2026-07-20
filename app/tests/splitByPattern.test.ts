import { describe, expect, it } from 'vite-plus/test';
import { splitByPattern } from '~/utils/splitByPattern';

describe('splitByPattern', () => {
  it('keeps matched and unmatched segments', () => {
    expect(splitByPattern('a:icon:b', /:[A-Za-z0-9_-]+:/)).toEqual([
      'a',
      ':icon:',
      'b',
    ]);
  });

  it('adds g flag when missing', () => {
    expect(splitByPattern('x1y2z', /\d/)).toEqual(['x', '1', 'y', '2', 'z']);
  });

  it('returns empty array for empty input', () => {
    expect(splitByPattern('', /a/)).toEqual([]);
  });

  it('returns whole text when no match', () => {
    expect(splitByPattern('plain', /:/)).toEqual(['plain']);
  });
});
