import { describe, expect, it } from 'vite-plus/test';
import { sidebarActiveTone } from '~/components/Sidebar';
import type { SidebarNode } from '~/lib/nav';

describe('sidebarActiveTone', () => {
  const leaf = (path: string): SidebarNode => ({ title: path, path });

  it('marks the current leaf as exact', () => {
    expect(sidebarActiveTone(leaf('/skill/a/b'), '/skill/a/b')).toBe('exact');
    expect(sidebarActiveTone(leaf('/skill/a/b'), '/skill/a/c')).toBe('none');
  });

  it('marks folder index as exact and descendants as ancestor', () => {
    const folder: SidebarNode = {
      title: '计算机基础',
      path: '/skill/计算机基础',
      children: [leaf('/skill/计算机基础/a'), leaf('/skill/计算机基础/b')],
    };
    expect(sidebarActiveTone(folder, '/skill/计算机基础')).toBe('exact');
    expect(sidebarActiveTone(folder, '/skill/计算机基础/a')).toBe('ancestor');
    expect(sidebarActiveTone(folder, '/skill/计算机基础/b')).toBe('ancestor');
  });

  it('uses matchPrefix when folder path aliases the first child', () => {
    const folder: SidebarNode = {
      title: '计算机基础',
      path: '/skill/计算机基础/「蓝盟」电脑维修',
      matchPrefix: '/skill/计算机基础',
      children: [
        leaf('/skill/计算机基础/「蓝盟」电脑维修'),
        leaf('/skill/计算机基础/关于epub文件'),
      ],
    };
    expect(
      sidebarActiveTone(folder, '/skill/计算机基础/「蓝盟」电脑维修'),
    ).toBe('ancestor');
    expect(sidebarActiveTone(folder, '/skill/计算机基础/关于epub文件')).toBe(
      'ancestor',
    );
    expect(
      sidebarActiveTone(
        leaf('/skill/计算机基础/「蓝盟」电脑维修'),
        '/skill/计算机基础/「蓝盟」电脑维修',
      ),
    ).toBe('exact');
  });
});
