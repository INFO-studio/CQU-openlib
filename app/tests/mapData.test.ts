import { describe, expect, it } from 'vite-plus/test';
import { BUILDING_CATEGORIES, BUILDINGS, CAMPUSES } from '~/pages/map/data';

describe('campus map data', () => {
  it('matches the published location count', () => {
    expect(BUILDINGS).toHaveLength(143);
  });

  it('uses the site-wide 校区 / 校园 terminology', () => {
    expect(
      CAMPUSES.map((campus) => `${campus.campusName}${campus.siteName}`),
    ).toEqual([
      '科学城校区虎溪校园',
      '沙坪坝校区A校园',
      '沙坪坝校区B校园',
      '沙坪坝校区C校园',
      '两江校区卓越工程师学院',
    ]);
  });

  it('keeps building ids unique and references valid', () => {
    const ids = BUILDINGS.map((building) => building.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const building of BUILDINGS) {
      expect(CAMPUSES.some((campus) => campus.id === building.campusId)).toBe(
        true,
      );
      expect(
        BUILDING_CATEGORIES.some(
          (category) => category.id === building.category,
        ),
      ).toBe(true);
    }
  });

  it('contains finite GCJ-02 longitude-latitude pairs', () => {
    for (const { coord } of BUILDINGS) {
      expect(coord).toHaveLength(2);
      expect(coord.every(Number.isFinite)).toBe(true);
      expect(coord[0]).toBeGreaterThan(100);
      expect(coord[0]).toBeLessThan(110);
      expect(coord[1]).toBeGreaterThan(25);
      expect(coord[1]).toBeLessThan(35);
    }
  });
});
