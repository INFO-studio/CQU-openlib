import { describe, expect, it } from 'vite-plus/test';
import { BUILDING_CATEGORIES, BUILDINGS, CAMPUSES } from '~/pages/map/data';

describe('campus map data', () => {
  it('keeps building ids unique and references valid', () => {
    const ids = BUILDINGS.map((building) => building.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const building of BUILDINGS) {
      expect(CAMPUSES.some((campus) => campus.id === building.campus)).toBe(
        true,
      );
      expect(
        BUILDING_CATEGORIES.some(
          (category) => category.id === building.category,
        ),
      ).toBe(true);
    }
  });

  it('contains finite BD09 longitude-latitude pairs', () => {
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
