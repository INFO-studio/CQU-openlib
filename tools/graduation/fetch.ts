/**
 * Crawls 重庆大学就业信息网「往届生查询」into a raw, untransformed CSV.
 *
 * The source page is public (no login, no captcha) and returns 单位级汇总人数
 * only — 毕业年度 / 去向类别 / 单位名称 / 人数. It carries no personal fields.
 * Everything here is deliberately dumb: no renaming, no merging, no masking.
 * Those all happen in build.ts, so the crawl stays auditable against the site.
 *
 * The query enums (届次 / 学历 / 院系 / 去向类别) are scraped from the form's
 * own <select> options rather than hardcoded, so a new 届 appears on its own.
 *
 *   pnpm graduation:fetch              # resumable full crawl, ~40min
 *   pnpm graduation:fetch --enums      # refresh enums.json only
 *   pnpm graduation:fetch --school 128 --grade 23 --education 30
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const ORIGIN = 'https://cqu.cqbys.com';
const FORM_URL = `${ORIGIN}/affair/lnjydw`;
const DATA_DIR = 'tools/graduation/data';
const ENUMS_FILE = join(DATA_DIR, 'enums.json');
const RAW_FILE = join(DATA_DIR, 'raw.csv');
const STATE_FILE = join(DATA_DIR, 'state.json');

const RAW_HEADER =
  'school_id,school_name,grade,education_code,education_name,毕业年度,去向类别,单位名称,人数';
/** The list renders 50 rows per page; the cap only guards against a pager loop. */
const MAX_PAGES = 40;
const THROTTLE_MS = 700;
const MAX_RETRIES = 6;

type Enums = {
  scrapedAt: string;
  grades: Array<{ value: string; label: string }>;
  educations: Array<{ value: string; label: string }>;
  schools: Array<{ value: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
};

type Combo = {
  school: string;
  schoolName: string;
  grade: string;
  education: string;
  educationName: string;
};

type ComboResult = { rows: RawRow[]; pages: number };

type RawRow = {
  year: string;
  category: string;
  org: string;
  count: string;
};

/** combo key → row count, so an interrupted crawl resumes without duplicating. */
type State = { startedAt: string; done: Record<string, number> };

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

const decodeEntities = (s: string): string =>
  s.replace(/&(#?\w+);/g, (full, name: string) => ENTITIES[name] ?? full);

const csvCell = (v: string): string =>
  /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

const fetchText = async (url: string): Promise<string> => {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: `${ORIGIN}/` },
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // The endpoint answers 200 with a login/captcha body when it gets angry.
      if (
        /验证码/.test(text) ||
        (/password/i.test(text) && /登录/.test(text))
      ) {
        throw new Error('looks like a login or captcha page');
      }
      return text;
    } catch (err) {
      lastErr = err;
      const backoff = Math.min(
        120_000,
        2 ** (attempt - 1) * 1000 + Math.random() * 3000,
      );
      console.warn(
        `  retry ${attempt}/${MAX_RETRIES} after ${(backoff / 1000).toFixed(1)}s — ${String(err)}`,
      );
      await sleep(backoff);
    }
  }
  throw new Error(`giving up on ${url}: ${String(lastErr)}`);
};

const parseOptions = (
  html: string,
  selectName: string,
): Array<{ value: string; label: string }> => {
  const block = new RegExp(
    `<select[^>]*name="${selectName.replace(/[[\]]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</select>`,
  ).exec(html);
  if (!block?.[1])
    throw new Error(
      `select "${selectName}" not found — the form markup changed`,
    );
  const out: Array<{ value: string; label: string }> = [];
  for (const m of block[1].matchAll(
    /<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g,
  )) {
    const value = (m[1] ?? '').trim();
    const label = decodeEntities((m[2] ?? '').replace(/<[^>]+>/g, '')).trim();
    if (value) out.push({ value, label });
  }
  return out;
};

const scrapeEnums = async (): Promise<Enums> => {
  const html = await fetchText(FORM_URL);
  const enums: Enums = {
    scrapedAt: new Date().toISOString(),
    grades: parseOptions(html, 'grade'),
    educations: parseOptions(html, 'education'),
    schools: parseOptions(html, 'school'),
    categories: parseOptions(html, 'University1950Lnjydw[jylb]'),
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(ENUMS_FILE, `${JSON.stringify(enums, null, 2)}\n`, 'utf8');
  console.log(
    `enums → ${ENUMS_FILE}: ${enums.grades.length} 届, ${enums.educations.length} 学历, ${enums.schools.length} 院系, ${enums.categories.length} 去向类别`,
  );
  return enums;
};

const pageUrl = (c: Combo, page: number): string => {
  const q = new URLSearchParams({
    grade: c.grade,
    education: c.education,
    school: c.school,
    major: '',
    'University1950Lnjydw[jylb]': '',
    submit: '1',
    page: String(page),
  });
  return `${FORM_URL}?${q.toString()}`;
};

/**
 * Each row is its own `<ul class="infoList">` holding exactly four `<li>`; the
 * values live in `title` so they survive CSS truncation. Reading whole blocks
 * keeps a stray `<li title>` elsewhere on the page from shifting every column.
 */
const parseRows = (html: string): RawRow[] => {
  const rows: RawRow[] = [];
  for (const block of html.matchAll(/<ul class="infoList">([\s\S]*?)<\/ul>/g)) {
    const cells = [
      ...(block[1] ?? '').matchAll(/<li[^>]*\btitle="([^"]*)"/g),
    ].map((m) => decodeEntities(m[1] ?? '').trim());
    if (cells.length !== 4) continue;
    const [year, category, org, count] = cells as [
      string,
      string,
      string,
      string,
    ];
    if (!/^\d{4}$/.test(year) || !/^\d+$/.test(count)) continue;
    rows.push({ year, category, org, count });
  }
  return rows;
};

const parseTotalPages = (html: string): number => {
  const m = /共\s*(\d+)\s*页/.exec(html);
  return m?.[1] ? Number(m[1]) : 1;
};

const crawlCombo = async (c: Combo): Promise<ComboResult> => {
  await sleep(THROTTLE_MS);
  const first = await fetchText(pageUrl(c, 1));
  if (first.includes('暂无数据')) return { rows: [], pages: 0 };

  const total = Math.min(parseTotalPages(first), MAX_PAGES);
  const rows = parseRows(first);
  for (let page = 2; page <= total; page += 1) {
    await sleep(THROTTLE_MS);
    const more = parseRows(await fetchText(pageUrl(c, page)));
    if (more.length === 0) break;
    rows.push(...more);
  }
  return { rows, pages: total };
};

const loadState = (): State =>
  existsSync(STATE_FILE)
    ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State)
    : { startedAt: new Date().toISOString(), done: {} };

const appendRows = (c: Combo, rows: RawRow[]): void => {
  if (rows.length === 0) return;
  const lines = rows.map((r) =>
    [
      c.school,
      c.schoolName,
      c.grade,
      c.education,
      c.educationName,
      r.year,
      r.category,
      r.org,
      r.count,
    ]
      .map(csvCell)
      .join(','),
  );
  appendFileSync(RAW_FILE, `${lines.join('\n')}\n`, 'utf8');
};

const argOf = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};

const main = async (): Promise<void> => {
  mkdirSync(DATA_DIR, { recursive: true });
  const enums = await scrapeEnums();
  if (process.argv.includes('--enums')) return;

  const onlySchool = argOf('--school');
  const onlyGrade = argOf('--grade');
  const onlyEducation = argOf('--education');

  const combos: Combo[] = [];
  for (const school of enums.schools) {
    if (onlySchool && school.value !== onlySchool) continue;
    for (const grade of enums.grades) {
      if (onlyGrade && grade.value !== onlyGrade) continue;
      for (const education of enums.educations) {
        if (onlyEducation && education.value !== onlyEducation) continue;
        combos.push({
          school: school.value,
          schoolName: school.label,
          grade: grade.value,
          education: education.value,
          educationName: education.label,
        });
      }
    }
  }

  const state = loadState();
  if (!existsSync(RAW_FILE)) writeFileSync(RAW_FILE, `${RAW_HEADER}\n`, 'utf8');

  console.log(
    `${combos.length} combos (${Object.keys(state.done).length} already done)\n`,
  );
  let rowTotal = Object.values(state.done).reduce((a, b) => a + b, 0);

  for (const [i, c] of combos.entries()) {
    const key = `${c.school}/${c.grade}/${c.education}`;
    if (state.done[key] !== undefined) continue;

    const { rows, pages } = await crawlCombo(c);
    appendRows(c, rows);
    state.done[key] = rows.length;
    writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    rowTotal += rows.length;

    const people = rows.reduce((sum, r) => sum + Number(r.count), 0);
    console.log(
      `[${i + 1}/${combos.length}] ${c.schoolName} ${c.grade}届 ${c.educationName} — ${rows.length} 行 / ${people} 人 / ${pages} 页 (累计 ${rowTotal} 行)`,
    );
  }

  console.log(`\nDONE. ${rowTotal} rows → ${RAW_FILE}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
