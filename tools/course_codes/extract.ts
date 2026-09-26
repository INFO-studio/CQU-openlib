import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PLAN_DIR = 'public/doc/academic/专业培养方案';
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
    note: 'Derived from training-plan markdown; regenerate via pnpm codes:extract',
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

const main = () => {
  if (!existsSync(PLAN_DIR)) throw new Error(`Missing plan dir: ${PLAN_DIR}`);
  const data = buildMetadata(
    listMarkdownFiles(PLAN_DIR).map((file) => readFileSync(file, 'utf8')),
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
