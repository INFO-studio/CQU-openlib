import { describe, expect, it } from 'vite-plus/test';
import { kebabToPascalCase, resolveLucideIconName } from '~/lib/icons';

describe('resolveLucideIconName', () => {
  it('resolves l- and lucide- prefixes', () => {
    expect(resolveLucideIconName('l-book')).toBe('book');
    expect(resolveLucideIconName('l-quote')).toBe('quote');
    expect(resolveLucideIconName('l-user')).toBe('user');
    expect(resolveLucideIconName('l-printer')).toBe('printer');
    expect(resolveLucideIconName('lucide-arrow-right')).toBe('arrow-right');
  });

  it('maps legacy material icons', () => {
    expect(resolveLucideIconName('material-book')).toBe('book');
    expect(resolveLucideIconName('material-arrow-up-circle')).toBe(
      'circle-arrow-up',
    );
  });

  it('converts kebab to PascalCase', () => {
    expect(kebabToPascalCase('circle-arrow-up')).toBe('CircleArrowUp');
  });
});
