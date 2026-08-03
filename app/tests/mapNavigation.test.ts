import { describe, expect, it } from 'vite-plus/test';
import { gcj02ToBd09, navigationLinksFor } from '~/pages/map/navigation';

describe('map navigation links', () => {
  const building = {
    name: '重庆大学图书馆',
    coord: [106.298877, 29.596799] as const,
  };

  it('builds links for all supported map providers', () => {
    const links = navigationLinksFor(building);
    expect(links.map((link) => link.id)).toEqual([
      'amap',
      'baidu',
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

    const [bdLongitude, bdLatitude] = gcj02ToBd09(building.coord);
    expect(links.baidu.searchParams.get('location')).toBe(
      `${bdLatitude},${bdLongitude}`,
    );
    expect(links.amap.origin + links.amap.pathname).toBe(
      'https://uri.amap.com/marker',
    );
    expect(links.amap.searchParams.get('position')).toBe(
      `${building.coord[0]},${building.coord[1]}`,
    );
    expect(links.amap.searchParams.get('name')).toBe(building.name);
    expect(links.amap.searchParams.get('coordinate')).toBe('gaode');
    expect(links.amap.searchParams.get('callnative')).toBe('1');
    expect(links.google.searchParams.get('query')).toBe(
      `${building.coord[1]},${building.coord[0]}`,
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

  it('shifts coordinates into BD09 only for Baidu', () => {
    const converted = gcj02ToBd09(building.coord);
    expect(converted.every(Number.isFinite)).toBe(true);
    // BD09 相对 GCJ-02 有几百米的固定偏移，落点不该一致。
    expect(converted[0]).toBeGreaterThan(building.coord[0]);
    expect(converted[1]).toBeGreaterThan(building.coord[1]);
  });
});
