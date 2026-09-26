import type { AlphaLetter } from '~/lib/courseAlpha';

export type NavSection = {
  id: string;
  label: string;
  path: string;
  source: string;
  kind: 'dir' | 'file';
  hiddenInNav?: boolean;
  /** Curated index links take precedence over the default title ordering. */
  indexOrder?: boolean;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'course',
    label: '课程',
    path: '/course',
    source: 'course',
    kind: 'dir',
  },
  {
    id: 'academic',
    label: '学业',
    path: '/academic',
    source: 'academic',
    kind: 'dir',
    indexOrder: true,
  },
  { id: 'club', label: '社团', path: '/club', source: 'club', kind: 'dir' },
  { id: 'skill', label: '技巧', path: '/skill', source: 'skill', kind: 'dir' },
  {
    id: 'life',
    label: '生活',
    path: '/life',
    source: 'life',
    kind: 'dir',
    indexOrder: true,
  },
  {
    id: 'contributor',
    label: '贡献者',
    path: '/contributor',
    source: 'contributor',
    kind: 'dir',
    indexOrder: true,
  },
  {
    id: 'sundry',
    label: '杂项',
    path: '/sundry',
    source: 'sundry',
    kind: 'dir',
  },
];
export const NAV_SECTIONS_VISIBLE = NAV_SECTIONS.filter(
  (section) => !section.hiddenInNav,
);
export type SiteNavItem =
  | NavSection
  | { id: 'map'; label: string; path: '/map'; kind: 'app' };
const MAP_NAV_ITEM: SiteNavItem = {
  id: 'map',
  label: '地图',
  path: '/map',
  kind: 'app',
};
export const SITE_NAV_ITEMS: SiteNavItem[] = NAV_SECTIONS_VISIBLE.flatMap(
  (section) => (section.id === 'life' ? [section, MAP_NAV_ITEM] : [section]),
);

export const SECTION_APP_PAGES: {
  section: string;
  title: string;
  path: string;
}[] = [
  { section: 'academic', title: '毕业去向', path: '/academic/graduation' },
];
export type SearchEntry = {
  title: string;
  path: string;
  section: string;
  sectionLabel: string;
  codes?: string[];
};
export type SidebarNode = {
  title: string;
  path: string;
  /** Folders without an index link to their first child but match the directory. */
  matchPrefix?: string;
  children?: SidebarNode[];
  codes?: string[];
  letter?: AlphaLetter;
};
export type DocNavIndex = {
  generatedAt: string;
  sections: Array<NavSection & { tree: SidebarNode[] }>;
};
export const sectionForPath = (pathname: string): NavSection | undefined => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return undefined;
  return NAV_SECTIONS.find(
    (section) => clean === section.path || clean.startsWith(`${section.path}/`),
  );
};

const titleInTree = (nodes: SidebarNode[], path: string): string | undefined =>
  nodes.reduce<string | undefined>((found, node) => {
    if (found !== undefined) return found;
    if (node.path === path) return node.title;
    return node.children?.length
      ? titleInTree(node.children, path) || undefined
      : undefined;
  }, undefined);

export const titleFromNav = (
  pathname: string,
  nav: DocNavIndex | null | undefined,
): string | undefined => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return '首页';
  const sectionRoot = NAV_SECTIONS.find((section) => section.path === clean);
  if (sectionRoot) return sectionRoot.label;
  return nav?.sections.reduce<string | undefined>(
    (found, section) => found || titleInTree(section.tree, clean) || undefined,
    undefined,
  );
};

export const titleFromPath = (filePath: string): string => {
  const base = filePath.split('/').pop() ?? filePath;
  const name = base.replace(/\.mdx?$/i, '');
  return name === 'index' ? (filePath.split('/').at(-2) ?? '首页') : name;
};
