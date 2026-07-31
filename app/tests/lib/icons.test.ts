import { describe, expect, it } from 'vite-plus/test';
import { resolveLucideIconName } from '~/lib/icons';

describe('resolveLucideIconName', () => {
  it('strips the l- prefix', () => {
    expect(resolveLucideIconName('l-book')).toBe('book');
    expect(resolveLucideIconName('l-book-open')).toBe('book-open');
    expect(resolveLucideIconName('l-gallery-vertical-end')).toBe(
      'gallery-vertical-end',
    );
  });

  it('rejects anything without the l- prefix', () => {
    expect(resolveLucideIconName('printer')).toBeNull();
    expect(resolveLucideIconName('material-book')).toBeNull();
    expect(resolveLucideIconName('l-')).toBeNull();
    expect(resolveLucideIconName('  ')).toBeNull();
  });
});
