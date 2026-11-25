import type { CourseCodeSearchEntry } from '~/lib/courseCodeSearch';
import type { DocNavIndex, SidebarNode } from '~/lib/nav';
import { cleanPath, decodePathname } from '~/lib/paths';
import { segmentZhText, type ZhVocabulary } from '~/lib/zhSegment';

export type ExactTitleEntry = {
  title: string;
  path: string;
  section: string;
  codes: string[];
};

export type SearchFragment = {
  url: string;
  excerpt: string;
  meta: Record<string, string>;
  sub_results: { url: string; title: string; excerpt: string }[];
};
export type SearchHit = {
  id: string;
  data: () => Promise<SearchFragment>;
};
export type SearchResult = {
  id: string;
  path: string;
  title: string;
  section: string;
  codes: string;
  excerpt: string;
  exact: boolean;
};
export type SearchEngine = {
  options: (options: {
    basePath?: string;
    baseUrl?: string;
    excerptLength: number;
  }) => Promise<void>;
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: SearchHit[] }>;
};

export type InitialSearchResults = {
  hits: SearchHit[];
  loadedHitCount: number;
  results: SearchResult[];
};

const asciiTokenPattern = /^[a-z0-9_-]+$/i;
const hanPattern = /\p{Script=Han}/gu;
const skipTitleSearchPrefixes = ['/sundry/更新日志/'];
const titleLookups = new WeakMap<DocNavIndex, Map<string, ExactTitleEntry[]>>();

const documentPath = (path: string): string =>
  cleanPath(decodePathname(path.split(/[?#]/, 1)[0] ?? path));

const isTitleSearchablePath = (path: string): boolean =>
  !skipTitleSearchPrefixes.some((prefix) => path.startsWith(prefix));

const normalizeTitleQuery = (value: string): string =>
  value.trim().toLowerCase();

const collectTreeEntries = (
  nodes: SidebarNode[],
  sectionLabel: string,
): ExactTitleEntry[] =>
  nodes.flatMap((node) => {
    const self =
      !node.matchPrefix && isTitleSearchablePath(node.path)
        ? [
            {
              title: node.title,
              path: node.path,
              section: sectionLabel,
              codes: (node.codes ?? []).map((code) => code.toUpperCase()),
            },
          ]
        : [];
    const nested = node.children?.length
      ? collectTreeEntries(node.children, sectionLabel)
      : [];
    return [...self, ...nested];
  });

const buildTitleLookup = (nav: DocNavIndex): Map<string, ExactTitleEntry[]> => {
  const entries: ExactTitleEntry[] = [
    { title: '首页', path: '/', section: '首页', codes: [] },
    ...nav.sections.flatMap((section) => [
      {
        title: section.label,
        path: section.path,
        section: section.label,
        codes: [],
      },
      ...collectTreeEntries(section.tree, section.label),
    ]),
  ];
  // Local Map is populated before returning and never mutated afterwards.
  return entries.reduce((lookup, entry) => {
    const key = normalizeTitleQuery(entry.title);
    const existing = lookup.get(key);
    lookup.set(key, existing ? [...existing, entry] : [entry]);
    return lookup;
  }, new Map<string, ExactTitleEntry[]>());
};

export const findExactTitles = (
  nav: DocNavIndex | null | undefined,
  query: string,
): ExactTitleEntry[] => {
  if (!nav) return [];
  const key = normalizeTitleQuery(query);
  if (!key) return [];
  const cached = titleLookups.get(nav);
  const lookup = cached ?? buildTitleLookup(nav);
  if (!cached) titleLookups.set(nav, lookup);
  return lookup.get(key) ?? [];
};

const pagefindQuery = (normalized: string, vocab?: ZhVocabulary): string => {
  const hanLength = normalized.match(hanPattern)?.length ?? 0;
  const phrase =
    asciiTokenPattern.test(normalized) ||
    (!normalized.includes(' ') && hanLength >= 5);
  const prepared = vocab ? segmentZhText(normalized, vocab) : normalized;
  return phrase ? `"${prepared}"` : prepared;
};

export const searchDocuments = async (
  engine: SearchEngine,
  query: string,
  vocab?: ZhVocabulary,
): Promise<SearchHit[]> => {
  const normalized = query.trim();
  if (!normalized) return [];
  return (await engine.search(pagefindQuery(normalized, vocab))).results;
};

export const loadSearchResults = async (
  hits: SearchHit[],
): Promise<SearchResult[]> =>
  Promise.all(
    hits.map(async (hit) => {
      const data = await hit.data();
      const sub = data.sub_results?.find((result) => result.url.includes('#'));
      return {
        id: hit.id,
        path: sub?.url ?? data.url,
        title: data.meta.label || data.meta.title,
        section: [data.meta.section, data.meta.heading || sub?.title]
          .filter(Boolean)
          .join(' · '),
        codes: data.meta.codes ?? '',
        excerpt: sub?.excerpt ?? data.excerpt,
        exact: false,
      };
    }),
  );

export const exactCourseCodeResults = (
  entries: CourseCodeSearchEntry[],
): SearchResult[] =>
  entries.map((entry) => ({
    id: `code:${entry.path}`,
    path: entry.path,
    title: entry.title,
    section: entry.section,
    codes: entry.codes.join(' '),
    excerpt: '',
    exact: true,
  }));

export const exactTitleResults = (
  entries: ExactTitleEntry[],
  fulltext: SearchResult[] = [],
): SearchResult[] => {
  // Local index keeps the highest-ranked fulltext snippet per document path.
  const fulltextByPath = fulltext.reduce((lookup, item) => {
    const key = documentPath(item.path);
    if (!lookup.has(key)) lookup.set(key, item);
    return lookup;
  }, new Map<string, SearchResult>());

  return entries.map((entry) => {
    const matched = fulltextByPath.get(documentPath(entry.path));
    return {
      id: `title:${entry.path}`,
      path: entry.path,
      title: entry.title,
      section: entry.section,
      codes: matched?.codes || entry.codes.join(' '),
      excerpt: matched?.excerpt ?? '',
      exact: false,
    };
  });
};

export const mergeSearchResults = (
  priority: SearchResult[],
  rest: SearchResult[],
): SearchResult[] => {
  const seen = new Set<string>();
  return [...priority, ...rest].filter(({ path }) => {
    const key = documentPath(path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const loadInitialSearchResults = async (
  engine: SearchEngine,
  query: string,
  exactEntries: CourseCodeSearchEntry[],
  pageSize: number,
  exactTitles: ExactTitleEntry[] = [],
  vocab?: ZhVocabulary,
): Promise<InitialSearchResults> => {
  const hits = await searchDocuments(engine, query, vocab);
  const loadedHitCount = Math.min(pageSize, hits.length);
  const fulltext = await loadSearchResults(hits.slice(0, loadedHitCount));
  const priority = mergeSearchResults(
    exactCourseCodeResults(exactEntries),
    exactTitleResults(exactTitles, fulltext),
  );
  return {
    hits,
    loadedHitCount,
    results: mergeSearchResults(priority, fulltext),
  };
};
