/**
 * Rebuilds metadata/course-codes.json from the 专业培养方案 markdown, which is
 * the only place course codes are written down. Re-run it whenever a plan file
 * gains, loses or renames a course link — the JSON is a derived artifact and
 * hand edits are lost on the next run.
 *
 * Recognised shape:
 *   [高等数学II-1](../../../course/高等数学.md) - :l-book:`MATH10821`
 *
 *   pnpm codes:extract
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const PLAN_DIR = 'public/doc/academic/专业培养方案';
const OUT_FILE = 'metadata/course-codes.json';

const ENTRY_RE =
  /\[([^\]]+)\]\(([^)]*?\/course\/[^)\s]+?\.mdx?)\)\s*-\s*:l-book:`([^`]+)`/g;

const listMarkdownFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(full));
      continue;
    }
    if (/\.mdx?$/i.test(entry.name)) out.push(full);
  }
  return out;
};

/** Resolve a markdown href that points under /course/ → site path. */
const hrefToCoursePath = (href: string): string | null => {
  const clean = href.replace(/\\/g, '/').split('#')[0]?.split('?')[0] ?? '';
  const m = clean.match(/(?:^|\/)course\/(.+?)\.mdx?$/i);
  if (!m?.[1]) return null;
  let rel = decodeURIComponent(m[1]);
  if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length);
  return `/course/${rel}`;
};

type Bucket = { codes: Set<string>; labels: Map<string, string> };

const main = () => {
  if (!existsSync(PLAN_DIR)) {
    console.error(`Missing plan dir: ${PLAN_DIR}`);
    process.exit(1);
  }

  const planFiles = listMarkdownFiles(PLAN_DIR);
  const byPath = new Map<string, Bucket>();
  /** code → path → occurrences */
  const codeVotes = new Map<string, Map<string, number>>();
  let matchCount = 0;

  for (const file of planFiles) {
    const text = readFileSync(file, 'utf8');
    ENTRY_RE.lastIndex = 0;
    let m: RegExpExecArray | null = ENTRY_RE.exec(text);
    for (; m !== null; m = ENTRY_RE.exec(text)) {
      const label = (m[1] ?? '').trim();
      const path = hrefToCoursePath(m[2] ?? '');
      const code = (m[3] ?? '').replace(/\s+/g, '');
      if (!path || !code) continue;
      matchCount += 1;

      let bucket = byPath.get(path);
      if (!bucket) {
        bucket = { codes: new Set(), labels: new Map() };
        byPath.set(path, bucket);
      }
      bucket.codes.add(code);
      if (!bucket.labels.has(code)) bucket.labels.set(code, label);

      let votes = codeVotes.get(code);
      if (!votes) {
        votes = new Map();
        codeVotes.set(code, votes);
      }
      votes.set(path, (votes.get(path) ?? 0) + 1);
    }
  }

  /** A code cited under two paths resolves to the one cited most often. */
  const byCode: Record<string, string> = {};
  const conflicts: Array<{
    code: string;
    winner: string;
    others: Array<{ path: string; count: number }>;
  }> = [];
  for (const [code, votes] of codeVotes) {
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const winner = ranked[0]?.[0];
    if (!winner) continue;
    byCode[code] = winner;
    if (ranked.length > 1) {
      conflicts.push({
        code,
        winner,
        others: ranked.slice(1).map(([p, n]) => ({ path: p, count: n })),
      });
    }
  }

  const courses: Record<
    string,
    { codes: string[]; labels: Record<string, string> }
  > = {};
  for (const [path, bucket] of [...byPath.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'zh-CN'),
  )) {
    const codes = [...bucket.codes].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    );
    courses[path] = {
      codes,
      labels: Object.fromEntries(
        codes.map((c) => [c, bucket.labels.get(c) ?? c]),
      ),
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: PLAN_DIR,
    note: 'Derived from training-plan markdown; regenerate via pnpm codes:extract',
    stats: {
      planFiles: planFiles.length,
      matches: matchCount,
      courses: Object.keys(courses).length,
      codes: Object.keys(byCode).length,
      conflicts: conflicts.length,
    },
    courses,
    byCode,
    conflicts: conflicts.slice(0, 50),
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    `Wrote ${OUT_FILE} — ${payload.stats.courses} courses, ${payload.stats.codes} codes (${payload.stats.matches} matches, ${payload.stats.conflicts} conflicts)`,
  );
};

main();
