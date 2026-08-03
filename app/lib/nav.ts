import type { AlphaLetter } from '~/lib/courseAlpha';

export type NavSection = {
  id: string;
  label: string;
  /** URL path prefix, e.g. /course */
  path: string;
  /** Relative dir under public/doc, or a single .md file */
  source: string;
  kind: 'dir' | 'file';
  /** Hide from header / mobile tabs (route + search can still exist). */
  hiddenInNav?: boolean;
  /**
   * Order the sidebar by the link order of the folder's index.md instead of by
   * title. For lists the index page curates by hand (贡献者 is ordered by join
   * time), an alphabetical sidebar contradicts the page readers just saw.
   */
  indexOrder?: boolean;
};
/** Top-level information architecture (mirrors the MkDocs site). */
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
  },
  { id: 'club', label: '社团', path: '/club', source: 'club', kind: 'dir' },
  { id: 'skill', label: '技巧', path: '/skill', source: 'skill', kind: 'dir' },
  { id: 'life', label: '生活', path: '/life', source: 'life', kind: 'dir' },
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
/** Sections shown in header / mobile directory tabs. */
export const NAV_SECTIONS_VISIBLE = NAV_SECTIONS.filter((s) => !s.hiddenInNav);
export type SiteNavItem =
  | NavSection
  | {
      id: 'map';
      label: '地图';
      path: '/map';
      kind: 'app';
    };
const MAP_NAV_ITEM: SiteNavItem = {
  id: 'map',
  label: '地图',
  path: '/map',
  kind: 'app',
};
/** Primary navigation, including app pages that do not belong to doc-index. */
export const SITE_NAV_ITEMS: SiteNavItem[] = NAV_SECTIONS_VISIBLE.flatMap(
  (section) => (section.id === 'life' ? [section, MAP_NAV_ITEM] : [section]),
);
export type SearchEntry = {
  title: string;
  path: string;
  section: string;
  sectionLabel: string;
  /** Course codes from metadata (e.g. MATH10821). */
  codes?: string[];
};
export type SearchChunkMeta = {
  id: string;
  /** Public URL, e.g. /search/chunks/course-A.json */
  url: string;
  label: string;
  count: number;
};
export type SearchChunkFile = {
  id: string;
  label: string;
  entries: SearchEntry[];
};
export type SidebarNode = {
  title: string;
  /** Click / navigation target. */
  path: string;
  /**
   * Directory URL used for ancestor expand + highlight.
   * Set when a folder has no index.md and `path` aliases the first child.
   */
  matchPrefix?: string;
  children?: SidebarNode[];
  /** Course codes from metadata (course section). */
  codes?: string[];
  /** A–Z bucket, computed at build time (course section leaves only). */
  letter?: AlphaLetter;
};
export type DocNavIndex = {
  generatedAt: string;
  sections: Array<
    NavSection & {
      tree: SidebarNode[];
    }
  >;
  /** Lightweight manifest; entries live in /search/chunks/*.json */
  searchManifest: {
    chunks: SearchChunkMeta[];
  };
};
export const sectionForPath = (pathname: string): NavSection | undefined => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return undefined;
  return NAV_SECTIONS.find(
    (s) => clean === s.path || clean.startsWith(`${s.path}/`),
  );
};

const titleInTree = (
  nodes: SidebarNode[],
  path: string,
): string | undefined => {
  for (const node of nodes) {
    if (node.path === path) return node.title;
    if (node.children?.length) {
      const found = titleInTree(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
};

/** Sidebar / section label for a public URL, if present in nav-index. */
export const titleFromNav = (
  pathname: string,
  nav: DocNavIndex | null | undefined,
): string | undefined => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return '首页';
  // Section roots are known without waiting for nav-index.json.
  const sectionRoot = NAV_SECTIONS.find((s) => s.path === clean);
  if (sectionRoot) return sectionRoot.label;
  if (!nav) return undefined;
  for (const section of nav.sections) {
    const found = titleInTree(section.tree, clean);
    if (found) return found;
  }
  return undefined;
};

export const titleFromPath = (filePath: string): string => {
  const base = filePath.split('/').pop() ?? filePath;
  const name = base.replace(/\.mdx?$/i, '');
  if (name === 'index') {
    const parts = filePath.split('/');
    return parts.at(-2) ?? '首页';
  }
  return name;
};
