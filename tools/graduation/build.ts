/**
 * Turns the raw crawl (tools/graduation/data/raw.csv, gitignored) into the
 * masked, dictionary-encoded chunks the /academic/graduation page fetches from
 * public/data/graduation/. Those chunks ARE committed — raw.csv is not, because
 * it still holds the <2 人 rows this script exists to mask away.
 *
 * Masking: inside every (grade × 学历 × 去向类别) group, a 单位 with fewer than
 * MASK_THRESHOLD people collapses into 「其他」. 升学 is exempt — 研究生院校名 is
 * not an identifying attribute and those counts are large. Every aggregation
 * level is masked from raw independently rather than by summing already-masked
 * college numbers, so a unit that took one person from each of thirty colleges
 * still shows its real school-wide total instead of thirty 「其他」 rows.
 *
 * Nothing is fetched here; re-crawl with pnpm graduation:fetch first.
 *
 *   pnpm graduation:build
 *   pnpm graduation:build --report   # also dump the top unmerged 单位名
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DATA_DIR = 'tools/graduation/data';
const RAW_FILE = join(DATA_DIR, 'raw.csv');
const ALIAS_FILE = 'tools/graduation/aliases.json';
const OUT_DIR = 'public/data/graduation';

const MASK_THRESHOLD = 2;
const MASK_EXEMPT = new Set(['升学']);
const MASK_LABEL = '其他';
const SOURCE_URL = 'https://cqu.cqbys.com/affair/lnjydw';

/**
 * Wire budget per detail page, measured after gzip because that is what the
 * browser actually pulls. It bounds the rows; page 0's residual adds a few
 * dozen bytes on top.
 *
 * Most rankings are nowhere near it — the median 院系 × 届 × 学历 view is half
 * a kilobyte — so they ship as one unsplit file and say nothing about paging.
 * Only the handful that exceed the budget get cut, and each page then declares
 * `hasMore` itself rather than making the client reason about row totals.
 */
const PAGE_BUDGET = 10 * 1024;

/** Path-safe stand-in for 「不限」 on any shard axis. */
const ALL = 'all';

/** 学历 goes in as its manifest index so the path stays ASCII. */
const detailPath = (
  scope: string,
  year: number | null,
  eduIndex: number | null,
  page: number,
): string => `detail/${scope}/${year ?? ALL}-${eduIndex ?? ALL}/${page}.json`;

type Row = {
  schoolId: string;
  schoolName: string;
  year: number;
  education: string;
  category: string;
  org: string;
  people: number;
};

type Aliases = { note?: string; merge: Record<string, string> };

type Correction = {
  org: string;
  from: string;
  to: string;
  why: string;
};

/**
 * Source-side classification fixes, applied only where the source is wrong on
 * its own terms — never to make a number look better.
 *
 * The bar is deliberately high. Of the 13,471 人 the site files under 升学,
 * 73 (0.5%) carry a 单位名 that is not a school at all; most are single-digit
 * and genuinely ambiguous (武汉光电国家实验室 and 中国国家画院 may well be
 * 联合培养), so they stay exactly as recorded. 村官 is the one unambiguous case
 * and the largest single item: it names a program rather than a 单位, and the
 * query form offers a 村官计划 category that no row ever uses.
 */
const CORRECTIONS: readonly Correction[] = [
  {
    org: '村官',
    from: '升学',
    to: '村官计划',
    why: '「村官」是项目名而非单位，且表单本就有无人使用的「村官计划」类别',
  },
];

const FULL_WIDTH: Record<string, string> = {
  '（': '(',
  '）': ')',
  '，': ',',
  '－': '-',
  '—': '-',
  '　': ' ',
  '：': ':',
  '／': '/',
  '＆': '&',
};

/**
 * Display form: the site should render one spelling of a name, so collapse
 * full-width punctuation and whitespace. Keeps the words themselves intact.
 */
const normalizeDisplay = (raw: string): string => {
  let s = raw
    .trim()
    .replace(/[（），－—　：／＆]/g, (ch) => FULL_WIDTH[ch] ?? ch);
  s = s
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')');
  return s;
};

/**
 * Merge key: the display name, redirected only by an explicit alias.
 *
 * Automatic subject extraction (stripping 法定后缀 / 括号内地域 / 分公司) was
 * measured and dropped: name variants almost never co-occur inside one
 * (届次 × 学历 × 去向类别) bucket, so merging changed the masked share by 0.0pp
 * while already producing a wrong merge (哈尔滨工业大学 vs 哈尔滨工业大学(深圳),
 * which admit separately). Group-level folding belongs in aliases.json where a
 * human signs off on each pair.
 */
const mergeKey = (display: string, aliases: Aliases): string =>
  aliases.merge[display] ?? display;

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

/** What each correction actually matched, so the manifest can report it. */
const applied = new Map<Correction, { rows: number; people: number }>();

const loadRaw = (): Row[] => {
  if (!existsSync(RAW_FILE)) {
    console.error(`Missing ${RAW_FILE} — run pnpm graduation:fetch first.`);
    process.exit(1);
  }
  const [header, ...body] = parseCsv(readFileSync(RAW_FILE, 'utf8'));
  if (!header) throw new Error('raw.csv is empty');
  const at = (name: string): number => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`raw.csv has no "${name}" column`);
    return i;
  };
  const [ci, cn, cy, ce, ck, co, cp] = [
    at('school_id'),
    at('school_name'),
    at('毕业年度'),
    at('education_name'),
    at('去向类别'),
    at('单位名称'),
    at('人数'),
  ];
  const out: Row[] = [];
  for (const r of body) {
    if (r.length < header.length) continue;
    const people = Number(r[cp]);
    const year = Number(r[cy]);
    if (!Number.isFinite(people) || !Number.isFinite(year)) continue;
    const org = normalizeDisplay(r[co] ?? '');
    let category = normalizeDisplay(r[ck] ?? '');
    const fix = CORRECTIONS.find((c) => c.org === org && c.from === category);
    if (fix) {
      category = fix.to;
      applied.set(fix, {
        rows: (applied.get(fix)?.rows ?? 0) + 1,
        people: (applied.get(fix)?.people ?? 0) + people,
      });
    }
    out.push({
      schoolId: r[ci] ?? '',
      schoolName: r[cn] ?? '',
      year,
      education: r[ce] ?? '',
      category,
      org,
      people,
    });
  }
  return out;
};

/** Dictionary that hands out a stable index per value in first-seen order. */
class Dict {
  private readonly index = new Map<string, number>();
  readonly values: string[] = [];
  idOf(value: string): number {
    const hit = this.index.get(value);
    if (hit !== undefined) return hit;
    const id = this.values.length;
    this.index.set(value, id);
    this.values.push(value);
    return id;
  }
}

type Group = { key: string; rows: Row[] };

/** Buckets rows by an arbitrary composite key. */
const groupBy = (rows: Row[], keyOf: (r: Row) => string): Group[] => {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const bucket = map.get(k);
    if (bucket) bucket.push(r);
    else map.set(k, [r]);
  }
  return [...map.entries()].map(([key, rs]) => ({ key, rows: rs }));
};

type Tally = { display: string; category: string; people: number };

/** Ranked real 单位, plus the residual each 去向 had to hide, kept apart. */
type Marginal = { ranked: Tally[]; masked: Array<[number, number]> };

/**
 * Collapses an arbitrary slice of raw rows into ranked per-(单位 × 去向) totals
 * with masking applied.
 *
 * Called once per *marginal* the UI can ask for, never per atomic bucket. That
 * distinction is the whole point: masking a (届 × 学历 × 类别) bucket and then
 * summing those buckets on the client hides anyone who was below the threshold
 * in every bucket they appear in, even when their total is far above it — on
 * the default 全校 × 全部届 × 全部学历 view that over-masked 14,377 人. Each
 * marginal is therefore derived from raw and masked on its own terms.
 *
 * Merging happens on mergeKey; the surviving display name is whichever spelling
 * covered the most people.
 *
 * The masked residual is returned beside the ranking rather than inside it: it
 * routinely outweighs every real 单位 (13,956 人 under 就业 school-wide), so
 * ranking it would seat 「其他」 at #1 and answer nobody's question. The page
 * footer discloses it instead.
 */
const tallyMarginal = (
  rows: Row[],
  aliases: Aliases,
  catIdx: Map<string, number>,
): Marginal => {
  const byKey = new Map<
    string,
    { category: string; people: number; names: Map<string, number> }
  >();
  for (const r of rows) {
    // 类别 stays part of the identity: 重庆大学 takes both 升学 and 就业, and
    // folding them would invent a total that answers no question.
    const key = `${r.category}\u0000${mergeKey(r.org, aliases)}`;
    let hit = byKey.get(key);
    if (!hit) {
      hit = { category: r.category, people: 0, names: new Map() };
      byKey.set(key, hit);
    }
    hit.people += r.people;
    hit.names.set(r.org, (hit.names.get(r.org) ?? 0) + r.people);
  }

  const out: Tally[] = [];
  const maskedByCategory = new Map<string, number>();
  for (const hit of byKey.values()) {
    const display = [...hit.names.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'),
    )[0]?.[0] as string;
    if (!MASK_EXEMPT.has(hit.category) && hit.people < MASK_THRESHOLD) {
      maskedByCategory.set(
        hit.category,
        (maskedByCategory.get(hit.category) ?? 0) + hit.people,
      );
      continue;
    }
    out.push({ display, category: hit.category, people: hit.people });
  }
  out.sort(
    (a, b) =>
      b.people - a.people || a.display.localeCompare(b.display, 'zh-CN'),
  );
  return {
    ranked: out,
    masked: [...maskedByCategory]
      .map(
        ([category, people]) =>
          [catIdx.get(category) as number, people] as [number, number],
      )
      .sort((a, b) => b[1] - a[1]),
  };
};

type DetailPage = {
  hasMore?: true;
  masked?: Array<[number, number]>;
  orgs: string[];
  rows: number[][];
};

/** Dictionary-encodes one slice of a ranking against its own name table. */
const encodePage = (
  slice: Tally[],
  catIdx: Map<string, number>,
): Pick<DetailPage, 'orgs' | 'rows'> => {
  const orgs = new Dict();
  const rows = slice.map((t) => [
    orgs.idOf(t.display),
    catIdx.get(t.category) as number,
    t.people,
  ]);
  return { orgs: orgs.values, rows };
};

const gzipBytes = (payload: unknown): number =>
  gzipSync(Buffer.from(JSON.stringify(payload))).length;

/**
 * Cuts a ranking into pages that each gzip under PAGE_BUDGET.
 *
 * Row count is the wrong unit: a page of 500 长三角某某科技有限公司 weighs far
 * more than 500 short 院校名, and the 单位名 table is most of the payload. So
 * each page takes as many rows as fit, found by bisection on the encoded size.
 */
const paginate = (ranked: Tally[], catIdx: Map<string, number>): number[][] => {
  // A view can legitimately rank nothing: in a small 院系 × 届 × 学历 slice
  // every 单位 may have taken exactly one person. It still needs a page, or the
  // client would get a 404 where it should read 「没有可列出的单位」.
  if (ranked.length === 0) return [[0, 0]];
  const cuts: number[][] = [];
  let start = 0;
  while (start < ranked.length) {
    const remaining = ranked.length - start;
    if (gzipBytes(encodePage(ranked.slice(start), catIdx)) <= PAGE_BUDGET) {
      cuts.push([start, ranked.length]);
      break;
    }
    let lo = 1;
    let hi = remaining;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const fits =
        gzipBytes(encodePage(ranked.slice(start, start + mid), catIdx)) <=
        PAGE_BUDGET;
      if (fits) lo = mid;
      else hi = mid - 1;
    }
    cuts.push([start, start + lo]);
    start += lo;
  }
  return cuts;
};

const writeJson = (relPath: string, payload: unknown): number => {
  const full = join(OUT_DIR, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, JSON.stringify(payload), 'utf8');
  return statSync(full).size;
};

const main = (): void => {
  const aliases: Aliases = existsSync(ALIAS_FILE)
    ? (JSON.parse(readFileSync(ALIAS_FILE, 'utf8')) as Aliases)
    : { merge: {} };

  const raw = loadRaw();
  if (raw.length === 0) throw new Error('raw.csv has no data rows');

  const grades = [...new Set(raw.map((r) => r.year))].sort((a, b) => b - a);
  const educations = ['本科', '硕士', '博士', '专科'].filter((e) =>
    raw.some((r) => r.education === e),
  );
  const categories = [...new Set(raw.map((r) => r.category))].sort(
    (a, b) =>
      raw.filter((r) => r.category === b).reduce((s, r) => s + r.people, 0) -
      raw.filter((r) => r.category === a).reduce((s, r) => s + r.people, 0),
  );
  const gradeIdx = new Map(grades.map((g, i) => [g, i]));
  const eduIdx = new Map(educations.map((e, i) => [e, i]));
  const catIdx = new Map(categories.map((c, i) => [c, i]));

  const colleges = [
    ...new Map(raw.map((r) => [r.schoolId, r.schoolName])).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });

  // ---- ranked detail shards, one per (院系 × 届 × 学历) marginal ------------
  //
  // The shard key holds exactly the facets that have to be pre-summed. 去向
  // stays inside each row instead: masking already pairs (类别, 单位), so
  // filtering a category out of a mixed shard gives byte-identical numbers to a
  // dedicated shard, and adding that 7th axis would have cost 4× the files.
  //
  // Rows arrive sorted by headcount and sliced into fixed pages, each carrying
  // only the 单位名 it references. Names are 52 of the old 86KB, so a page is
  // ~7KB however deep the ranking goes — the client fetches rank 1–500 and
  // stops, instead of downloading 5,303 rows to render 40.
  const collegeMeta: Array<{
    id: string;
    name: string;
    people: number;
  }> = colleges.map((c) => ({
    id: c.id,
    name: c.name,
    people: raw
      .filter((r) => r.schoolId === c.id)
      .reduce((s, r) => s + r.people, 0),
  }));

  const scopeKeys: Array<{ key: string; rows: Row[] }> = [
    { key: ALL, rows: raw },
    ...colleges.map((c) => ({
      key: c.id,
      rows: raw.filter((r) => r.schoolId === c.id),
    })),
  ];

  let detailFiles = 0;
  let detailBytes = 0;
  let maxFirstPage = 0;
  let maxPages = 0;
  let views = 0;
  let splitViews = 0;

  for (const scope of scopeKeys) {
    for (const year of [null, ...grades]) {
      const byYear =
        year === null ? scope.rows : scope.rows.filter((r) => r.year === year);
      if (byYear.length === 0) continue;
      for (const edu of [null, ...educations]) {
        const slice =
          edu === null ? byYear : byYear.filter((r) => r.education === edu);
        if (slice.length === 0) continue;

        const { ranked, masked } = tallyMarginal(slice, aliases, catIdx);
        const cuts = paginate(ranked, catIdx);
        maxPages = Math.max(maxPages, cuts.length);
        views += 1;
        if (cuts.length > 1) splitViews += 1;

        for (const [p, [from, to]] of cuts.entries()) {
          const page: DetailPage = {
            // Only the last page stays silent, which is what ends the client's
            // paging loop — no row arithmetic, no index file to keep in sync.
            ...(p < cuts.length - 1 ? { hasMore: true as const } : {}),
            // The withheld residual describes the whole ranking, so it rides
            // on page 0 — always the first fetch.
            ...(p === 0 && masked.length > 0 ? { masked } : {}),
            ...encodePage(ranked.slice(from, to), catIdx),
          };

          detailBytes += writeJson(
            detailPath(
              scope.key,
              year,
              edu === null ? null : (eduIdx.get(edu) as number),
              p,
            ),
            page,
          );
          detailFiles += 1;
          // Reported over the wire, which is the number the budget bounds.
          if (p === 0) maxFirstPage = Math.max(maxFirstPage, gzipBytes(page));
        }
      }
    }
  }

  // ---- overview: headcount per college × grade × 学历 × 类别 ----------------
  // Pure counts, no 单位名, so these stay exact rather than masked.
  const collegePos = new Map(collegeMeta.map((c, i) => [c.id, i]));
  const cells: number[][] = [];
  for (const g of groupBy(
    raw,
    (r) => `${r.schoolId}|${r.year}|${r.education}|${r.category}`,
  )) {
    const [sid, y, e, c] = g.key.split('|') as [string, string, string, string];
    cells.push([
      collegePos.get(sid) as number,
      gradeIdx.get(Number(y)) as number,
      eduIdx.get(e) as number,
      catIdx.get(c) as number,
      g.rows.reduce((s, r) => s + r.people, 0),
      new Set(g.rows.map((r) => mergeKey(r.org, aliases))).size,
    ]);
  }
  const overviewBytes = writeJson('overview.json', { cells });

  const manifestBytes = writeJson('manifest.json', {
    generatedAt: new Date().toISOString(),
    source: SOURCE_URL,
    policy: {
      maskThreshold: MASK_THRESHOLD,
      maskExempt: [...MASK_EXEMPT],
      maskLabel: MASK_LABEL,
      note: '每个筛选组合独立脱敏；overview 的人数为精确值（不含单位名）。',
    },
    detail: { pageBudget: PAGE_BUDGET, all: ALL },
    corrections: [...applied.entries()].map(([fix, hit]) => ({
      org: fix.org,
      from: fix.from,
      to: fix.to,
      why: fix.why,
      rows: hit.rows,
      people: hit.people,
    })),
    grades,
    educations,
    categories,
    colleges: collegeMeta,
    stats: {
      rawRows: raw.length,
      people: raw.reduce((s, r) => s + r.people, 0),
      colleges: colleges.length,
      overviewCells: cells.length,
      detailFiles,
    },
  });

  const kb = (n: number): string => `${(n / 1024).toFixed(1)}KB`;
  console.log(`raw ${raw.length} rows → ${OUT_DIR}`);
  console.log(`  manifest.json  ${kb(manifestBytes)}`);
  console.log(`  overview.json  ${kb(overviewBytes)}  (${cells.length} cells)`);
  console.log(
    `  detail/**      ${kb(detailBytes)}，${views} 个视图 → ${detailFiles} 个文件`,
  );
  console.log(
    `                 其中 ${splitViews} 个视图超过 ${kb(PAGE_BUDGET)} 需分片（最深 ${maxPages} 页），其余 ${views - splitViews} 个单文件直出`,
  );
  console.log(`  任意视图首次明细请求 <= ${kb(maxFirstPage)} gzip`);
  console.log(
    `  ${grades.length} 届 (${grades.at(-1)}–${grades[0]}), ${educations.length} 学历, ${categories.length} 去向类别`,
  );
  for (const [fix, hit] of applied) {
    console.log(
      `  修正 ${fix.org}：${fix.from} → ${fix.to}（${hit.rows} 行 / ${hit.people} 人）`,
    );
  }
  for (const fix of CORRECTIONS) {
    if (!applied.has(fix)) {
      console.warn(
        `  警告：修正规则未命中任何行（${fix.org} / ${fix.from}）——源数据可能已变，请复核`,
      );
    }
  }

  if (process.argv.includes('--report')) {
    const totals = new Map<string, number>();
    for (const r of raw) {
      const k = mergeKey(r.org, aliases);
      totals.set(k, (totals.get(k) ?? 0) + r.people);
    }
    console.log(
      '\ntop 40 merge keys — extend aliases.json if any two belong together:',
    );
    for (const [k, n] of [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)) {
      console.log(`  ${String(n).padStart(5)}  ${k}`);
    }
  }
};

main();
