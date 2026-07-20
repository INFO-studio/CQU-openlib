/**
 * Temporary one-shot: scrape course codes from 专业培养方案 markdown
 * into public/metadata/course-codes.json.
 *
 * Pattern:
 *   [高等数学II-1](../../../course/高等数学.md) - :l-book:`MATH10821`
 *
 * Usage: node scripts/extract-course-codes.mjs
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_DIR = join(ROOT, 'public/doc/academic/专业培养方案');
const OUT_FILE = join(ROOT, 'public/metadata/course-codes.json');

/** [label](.../course/xxx.md) - :l-book:`CODE` */
const ENTRY_RE =
  /\[([^\]]+)\]\(([^)]*?\/course\/[^)\s]+?\.mdx?)\)\s*-\s*:l-book:`([^`]+)`/g;

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
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
}

/** Resolve a markdown href that points under /course/ → site path. */
function hrefToCoursePath(href) {
  const clean = href.replace(/\\/g, '/').split('#')[0]?.split('?')[0] ?? '';
  const m = clean.match(/(?:^|\/)course\/(.+?)\.mdx?$/i);
  if (!m) return null;
  let rel = decodeURIComponent(m[1]);
  if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length);
  return `/course/${rel}`;
}

function normalizeCode(raw) {
  return raw.trim().replace(/\s+/g, '');
}

function main() {
  if (!existsSync(PLAN_DIR)) {
    console.error(`Missing plan dir: ${PLAN_DIR}`);
    process.exit(1);
  }

  /** @type {Map<string, { codes: Set<string>, labels: Map<string, string> }>} */
  const byPath = new Map();
  /** @type {Map<string, Map<string, number>>} code → path → count */
  const codeVotes = new Map();
  let matchCount = 0;

  for (const file of listMarkdownFiles(PLAN_DIR)) {
    const text = readFileSync(file, 'utf8');
    ENTRY_RE.lastIndex = 0;
    let m;
    while ((m = ENTRY_RE.exec(text)) !== null) {
      const label = m[1].trim();
      const path = hrefToCoursePath(m[2]);
      const code = normalizeCode(m[3]);
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

  /** Prefer the path with most occurrences for a given code. */
  const byCode = {};
  const conflicts = [];
  for (const [code, votes] of codeVotes) {
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const winner = ranked[0][0];
    byCode[code] = winner;
    if (ranked.length > 1) {
      conflicts.push({
        code,
        winner,
        others: ranked.slice(1).map(([p, n]) => ({ path: p, count: n })),
      });
    }
  }

  const courses = {};
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
    source: 'public/doc/academic/专业培养方案',
    note: 'Temporary extract from training-plan markdown; regenerate via scripts/extract-course-codes.mjs',
    stats: {
      planFiles: listMarkdownFiles(PLAN_DIR).length,
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
    `Wrote ${relative(ROOT, OUT_FILE)} — ${payload.stats.courses} courses, ${payload.stats.codes} codes (${payload.stats.matches} matches, ${payload.stats.conflicts} conflicts)`,
  );
}

main();
