import { describe, expect, it } from 'vite-plus/test';
import { captureInitialHash } from '~/hooks/useHashScroll';

describe('captureInitialHash', () => {
  it('keeps the entry hash when only the hash changes in the same page', () => {
    const entry = {
      pathname: '/life/校车时刻表',
      hash: '#官方时刻表',
      handled: true,
    };

    expect(
      captureInitialHash(entry, {
        pathname: '/life/校车时刻表',
        hash: '#运营说明',
      }),
    ).toBe(entry);
  });

  it('captures a new entry hash when navigating to another page', () => {
    expect(
      captureInitialHash(
        { pathname: '/life/校车时刻表', hash: '', handled: true },
        { pathname: '/academic/入学必看', hash: '#报到' },
      ),
    ).toEqual({
      pathname: '/academic/入学必看',
      hash: '#报到',
      handled: false,
    });
  });
});
