import { describe, expect, it } from 'vite-plus/test';
import { bd09ToGcj02, navigationLinksFor } from '~/pages/map/navigation';

describe('map navigation links', () => {
  const building = {
    name: '重庆大学图书馆',
    coord: [106.305322, 29.602937] as const,
  };

  it('builds links for all supported map providers', () => {
    const links = navigationLinksFor(building);
    expect(links.map((link) => link.id)).toEqual([
      'baidu',
      'amap',
      'tencent',
      'google',
      'apple',
    ]);
    expect(
      links.every((link) => new URL(link.href).protocol === 'https:'),
    ).toBe(true);
  });

  it('includes every provider-required marker parameter', () => {
    const links = Object.fromEntries(
      navigationLinksFor(building).map((link) => [link.id, new URL(link.href)]),
    );

    expect(links.baidu.searchParams.get('location')).toBe(
      '29.602937,106.305322',
    );
    expect(links.baidu.searchParams.get('title')).toBe(building.name);
    expect(links.baidu.searchParams.get('content')).toBe(building.name);
    expect(links.baidu.searchParams.get('output')).toBe('html');
    expect(links.baidu.searchParams.get('src')).toBe(
      'webapp.INFO-studio.CQU-openlib',
    );

    const tencentMarker = links.tencent.searchParams.get('marker');
    expect(tencentMarker).toContain(`title:${building.name}`);
    expect(tencentMarker).toContain(`addr:${building.name}`);
    expect(links.tencent.searchParams.get('referer')).toBe('CQU-openlib');
  });

  it('converts BD09 before handing coordinates to non-Baidu maps', () => {
    const converted = bd09ToGcj02(building.coord);
    expect(converted.every(Number.isFinite)).toBe(true);
    expect(converted[0]).not.toBe(building.coord[0]);
    expect(converted[1]).not.toBe(building.coord[1]);
  });
});
