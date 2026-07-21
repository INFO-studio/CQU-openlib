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
    id: 'curriculum',
    label: '课表',
    path: '/curriculum',
    source: 'curriculum.md',
    kind: 'file',
    hiddenInNav: true,
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
export const titleFromPath = (filePath: string): string => {
  const base = filePath.split('/').pop() ?? filePath;
  const name = base.replace(/\.mdx?$/i, '');
  if (name === 'index') {
    const parts = filePath.split('/');
    return parts.at(-2) ?? '首页';
  }
  return name;
};
