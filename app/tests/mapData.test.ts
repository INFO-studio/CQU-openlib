import { describe, expect, it } from 'vite-plus/test';
import {
  CAMPUSES,
  loadAllMapItems,
  MAP_ITEM_CATEGORIES,
} from '~/pages/map/data';

describe('campus map data', () => {
  it('matches the published location count', async () => {
    expect(await loadAllMapItems()).toHaveLength(162);
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

  it('keeps map item ids unique and references valid', async () => {
    const items = await loadAllMapItems();
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of items) {
      expect(CAMPUSES.some((campus) => campus.id === item.campusId)).toBe(true);
      expect(
        MAP_ITEM_CATEGORIES.some((category) => category.id === item.category),
      ).toBe(true);
    }
  });

  it('contains finite GCJ-02 longitude-latitude pairs', async () => {
    for (const { coord } of await loadAllMapItems()) {
      expect(coord).toHaveLength(2);
      expect(coord.every(Number.isFinite)).toBe(true);
      expect(coord[0]).toBeGreaterThan(100);
      expect(coord[0]).toBeLessThan(110);
      expect(coord[1]).toBeGreaterThan(25);
      expect(coord[1]).toBeLessThan(35);
    }
  });

  it('does not repeat a map item name as its description', async () => {
    const normalize = (value: string) =>
      value.replace(/[，,。.;；\s]/g, '').toLocaleLowerCase('zh-CN');

    for (const item of await loadAllMapItems()) {
      if (item.desc) {
        expect(normalize(item.desc)).not.toBe(normalize(item.name));
      }
    }
  });
});
