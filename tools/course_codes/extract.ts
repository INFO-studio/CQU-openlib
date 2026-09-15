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

export const extractEntries = (text: string) => {
  const entries: Array<{ label: string; path: string; code: string }> = [];
  for (const match of text.matchAll(ENTRY_RE)) {
    const label = (match[1] ?? '')
      .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1')
      .trim();
    const href = match[2] ?? '';
    const relative = href.match(/(?:^|\/)course\/(.+?)\.mdx?$/i)?.[1];
    const code = (match[4] ?? '').trim().replace(/^\*+/, '');
    if (!relative || !code || code === '未提供') continue;
    const decoded = decodeURIComponent(relative).replace(/\/index$/, '');
    if (decoded.split('/').some((part) => part === '..' || part === '.')) {
      throw new Error(`Invalid course path: ${href}`);
    }
    entries.push({ label, path: `/course/${decoded}`, code });
  }
  return entries;
};

export const buildMetadata = (documents: string[]) => {
  const byPath = new Map<string, Map<string, string>>();
  const occurrences = new Map<string, Map<string, number>>();
  let matchCount = 0;
  for (const text of documents) {
    for (const { label, path, code } of extractEntries(text)) {
      matchCount += 1;
      const bucket = byPath.get(path) ?? new Map<string, string>();
      if (!bucket.has(code)) bucket.set(code, label);
      byPath.set(path, bucket);
      const paths = occurrences.get(code) ?? new Map<string, number>();
      paths.set(path, (paths.get(path) ?? 0) + 1);
      occurrences.set(code, paths);
    }
  }
  const byCode: Record<string, string> = {};
  const conflicts: Array<{
    code: string;
    candidates: Array<{ path: string; count: number }>;
  }> = [];
  for (const [code, paths] of [...occurrences].sort(([a], [b]) =>
    a.localeCompare(b, 'en'),
  )) {
    const candidates = [...paths].sort(([a], [b]) =>
      a.localeCompare(b, 'zh-CN'),
    );
    const onlyPath = candidates[0]?.[0];
    if (candidates.length === 1 && onlyPath) {
      byCode[code] = onlyPath;
    } else {
      // 出现次数不能证明课程归属，歧义只保留候选，不指定胜者。
      conflicts.push({
        code,
        candidates: candidates.map(([path, count]) => ({ path, count })),
      });
    }
  }
  const courses: Record<
    string,
    { codes: string[]; labels: Record<string, string> }
  > = {};
  for (const [path, bucket] of [...byPath].sort(([a], [b]) =>
    a.localeCompare(b, 'zh-CN'),
  )) {
    const codes = [...bucket.keys()].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    );
    courses[path] = {
      codes,
      labels: Object.fromEntries(
        codes.map((code) => [code, bucket.get(code) ?? code]),
      ),
    };
  }
  return {
    source: PLAN_DIR,
    note: 'Derived from training-plan markdown; regenerate via pnpm codes:extract',
    stats: {
      planFiles: documents.length,
      matches: matchCount,
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
  for (const page of Object.keys(data.courses)) {
    if (!existsSync(join('public/doc', `${page.slice(1)}.md`))) {
      throw new Error(`Missing course page: ${page}`);
    }
  }
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
