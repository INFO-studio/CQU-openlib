import { describe, expect, it } from 'vite-plus/test';
import { campusIdFromMapItemId, isCampusId } from '~/pages/map/utils/campus';

describe('map campus utilities', () => {
  it('accepts only published campus ids', () => {
    expect(isCampusId('a')).toBe(true);
    expect(isCampusId('e')).toBe(true);
    expect(isCampusId('huxi')).toBe(false);
    expect(isCampusId(null)).toBe(false);
  });

  it('derives campus ids from map item ids including legacy huxi ids', () => {
    expect(campusIdFromMapItemId('a_library')).toBe('a');
    expect(campusIdFromMapItemId('huxi_library')).toBe('d');
    expect(campusIdFromMapItemId('unknown_library')).toBeNull();
    expect(campusIdFromMapItemId(undefined)).toBeNull();
  });
});
