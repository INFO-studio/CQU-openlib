import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const PLAN_DIR = 'public/doc/academic/专业培养方案';
const COURSE_DIR = 'public/doc/course';
const OUT_FILE = 'metadata/course-codes.json';
const ENTRY_RE =
  /\[((?:\\.|[^\]\\])+)\]\(([^\n]*?\/course\/[^\n]+?\.mdx?)\)\s*-\s*:l-book:(`+)(.+?)\3/g;

const listMarkdownFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory()
        ? listMarkdownFiles(full)
        : /\.mdx?$/i.test(entry.name)
          ? [full]
          : [];
    })
    .sort();
};

export const extractEntries = (text: string) =>
  [...text.matchAll(ENTRY_RE)].flatMap((matched) => {
    const label = (matched[1] ?? '')
      .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1')
      .trim();
    const href = matched[2] ?? '';
    const relative = href.match(/(?:^|\/)course\/(.+?)\.mdx?$/i)?.[1];
    const code = (matched[4] ?? '').trim().replace(/^\*+/, '');
    if (!relative || !code || code === '未提供') return [];
    const decoded = decodeURIComponent(relative).replace(/\/index$/, '');
    if (decoded.split('/').some((part) => part === '..' || part === '.')) {
      throw new Error(`Invalid course path: ${href}`);
    }
    return [{ label, path: `/course/${decoded}`, code }];
  });

export const buildMetadata = (documents: string[]) => {
  const entries = documents.flatMap(extractEntries);
  const byPath = new Map<string, Map<string, string>>();
  const occurrences = new Map<string, Map<string, number>>();
  // Aggregate only into fresh local maps; copying them per entry is quadratic.
  entries.forEach(({ label, path, code }) => {
    const bucket = byPath.get(path) ?? new Map<string, string>();
    if (!bucket.has(code)) bucket.set(code, label);
    byPath.set(path, bucket);
    const paths = occurrences.get(code) ?? new Map<string, number>();
    paths.set(path, (paths.get(path) ?? 0) + 1);
    occurrences.set(code, paths);
  });
  const candidatesByCode = [...occurrences]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([code, paths]) => ({
      code,
      candidates: [...paths]
        .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
        .map(([path, count]) => ({ path, count })),
    }));
  const byCode = Object.fromEntries(
    candidatesByCode.flatMap(({ code, candidates }) =>
      candidates.length === 1 && candidates[0]?.path
        ? [[code, candidates[0].path]]
        : [],
    ),
  );
  // Frequency does not establish course ownership; ambiguous codes have no winner.
  const conflicts = candidatesByCode.filter(
    ({ candidates }) => candidates.length !== 1,
  );
  const courses = Object.fromEntries(
    [...byPath]
      .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
      .map(([path, bucket]) => {
        const codes = [...bucket.keys()].sort((a, b) =>
          a.localeCompare(b, 'en', { sensitivity: 'base' }),
        );
        return [
          path,
          {
            codes,
            labels: Object.fromEntries(
              codes.map((code) => [code, bucket.get(code) ?? code]),
            ),
          },
        ];
      }),
  );
  return {
    source: PLAN_DIR,
    note: 'Derived from training-plan markdown. Course-page tabs whose codes are absent from plans are kept and never reassigned. Regenerate via pnpm codes:extract',
    stats: {
      planFiles: documents.length,
      matches: entries.length,
      courses: Object.keys(courses).length,
      codes: occurrences.size,
      conflicts: conflicts.length,
    },
    courses,
    byCode,
    conflicts,
  };
};

export type PageTab = { path: string; code: string };

const compareCode = (left: string, right: string): number =>
  left.localeCompare(right, 'en', { sensitivity: 'base' });

const pageTitle = (path: string): string => path.split('/').at(-1) ?? path;

export const courseTabCodes = (
  pages: readonly { path: string; text: string }[],
): PageTab[] =>
  pages.flatMap(({ path, text }) =>
    [...text.matchAll(/^=== ":l-book:`([^`]+)`"/gm)].flatMap((matched) => {
      const code = (matched[1] ?? '').trim().replace(/^\*+/, '');
      if (!code || code === '未提供') return [];
      return [{ path, code }];
    }),
  );

export const retainPageCodes = (
  metadata: ReturnType<typeof buildMetadata>,
  tabs: readonly PageTab[],
) => {
  const owned = new Set(
    Object.values(metadata.courses).flatMap((entry) => entry.codes),
  );
  // Fresh local map. Codes already claimed by a plan stay on that page.
  const grouped = tabs
    .filter((tab) => !owned.has(tab.code))
    .reduce((map, tab) => {
      const current = map.get(tab.path) ?? [];
      const codes = current.includes(tab.code)
        ? current
        : [...current, tab.code];
      map.set(tab.path, codes);
      return map;
    }, new Map<string, string[]>());
  const courses = Object.fromEntries(
    [...new Set([...Object.keys(metadata.courses), ...grouped.keys()])]
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))
      .map((path) => {
        const existing = metadata.courses[path];
        const extra = [...(grouped.get(path) ?? [])].sort(compareCode);
        const codes = [...new Set([...(existing?.codes ?? []), ...extra])].sort(
          compareCode,
        );
        return [
          path,
          {
            codes,
            labels: Object.fromEntries(
              codes.map((code) => [
                code,
                existing?.labels[code] ?? pageTitle(path),
              ]),
            ),
          },
        ];
      }),
  );
  const uniqueExtra = [...new Set([...grouped.values()].flat())].sort(
    compareCode,
  );
  const byCode = { ...metadata.byCode };
  const addedConflicts = uniqueExtra.flatMap((code) => {
    const paths = [...grouped.entries()]
      .filter(([, codes]) => codes.includes(code))
      .map(([path]) => path)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));
    const only = paths.length === 1 ? paths[0] : undefined;
    if (only) {
      byCode[code] = only;
      return [];
    }
    return [
      {
        code,
        candidates: paths.map((path) => ({ path, count: 1 })),
      },
    ];
  });
  return {
    ...metadata,
    stats: {
      ...metadata.stats,
      courses: Object.keys(courses).length,
      codes: new Set(Object.values(courses).flatMap((entry) => entry.codes))
        .size,
      conflicts: metadata.conflicts.length + addedConflicts.length,
    },
    courses,
    byCode,
    conflicts: [...metadata.conflicts, ...addedConflicts],
  };
};

const coursePagePath = (file: string): string =>
  `/course/${relative(COURSE_DIR, file)
    .split(sep)
    .join('/')
    .replace(/\.mdx?$/i, '')
    .replace(/\/index$/, '')}`;

const main = () => {
  if (!existsSync(PLAN_DIR)) throw new Error(`Missing plan dir: ${PLAN_DIR}`);
  const data = retainPageCodes(
    buildMetadata(
      listMarkdownFiles(PLAN_DIR).map((file) => readFileSync(file, 'utf8')),
    ),
    courseTabCodes(
      listMarkdownFiles(COURSE_DIR).map((file) => ({
        path: coursePagePath(file),
        text: readFileSync(file, 'utf8'),
      })),
    ),
  );
  const missing = Object.keys(data.courses).find(
    (page) => !existsSync(join('public/doc', `${page.slice(1)}.md`)),
  );
  if (missing) throw new Error(`Missing course page: ${missing}`);
  const previous = existsSync(OUT_FILE)
    ? JSON.parse(readFileSync(OUT_FILE, 'utf8'))
    : null;
  const { generatedAt: previousDate, ...previousData } = previous ?? {};
  const generatedAt =
    JSON.stringify(previousData) === JSON.stringify(data)
      ? previousDate
      : new Date().toISOString();
  const content = `${JSON.stringify({ generatedAt, ...data }, null, 2)}\n`;
  if (!existsSync(OUT_FILE) || readFileSync(OUT_FILE, 'utf8') !== content) {
    mkdirSync(dirname(OUT_FILE), { recursive: true });
    writeFileSync(OUT_FILE, content, 'utf8');
  }
  console.log(
    `Course metadata: ${data.stats.courses} courses, ${data.stats.codes} codes, ${data.stats.conflicts} conflicts`,
  );
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
