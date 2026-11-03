import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldCourseName } from './folds';

export const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(TOOL_DIR, '../..');

export type StoredValue = string | number | null;
export type RawFields = Record<string, StoredValue>;

export type Source = {
  file: string;
  sheet: string;
  row: number;
};

export type LinkMethod =
  | 'name'
  | 'simplified_name'
  | 'code'
  | 'ambiguous_code'
  | 'unlinked';

export type CourseRecord = {
  college: string;
  major: string;
  year: string;
  level: string | null;
  category: string | null;
  nature: string | null;
  name: string | null;
  code: string | null;
  semester_raw: string | null;
  remarks: string | null;
  total_credits: string | null;
  semesters: string[];
  course_page: string | null;
  link_method: LinkMethod;
  raw_fields: RawFields;
  sources: Source[];
};

export type Summary = {
  files: number;
  input_rows: number;
  input_rows_by_file: Record<string, number>;
  excluded_minor_or_dual_degree: number;
  retained_rows: number;
  duplicate_rows_merged: number;
  unique_records: number;
  colleges: number;
  major_pages: number;
  records_by_year: Record<string, number>;
  records_by_category: Record<string, number>;
  records_by_level: Record<string, number>;
  zero_credits: number;
  missing_credits: number;
  missing_semesters: number;
  multi_semester_records: number;
  records_with_remarks: number;
  link_methods: Record<string, number>;
};

export type CleanData = {
  schema_version: number;
  summary: Summary;
  records: CourseRecord[];
};

export type Bundle = CleanData & {
  markdown_previews: Record<string, string>;
};

export type CourseMetadata = {
  codes: string[];
};

export type Metadata = {
  courses?: Record<string, CourseMetadata>;
};

export type CourseLinks = {
  pages: ReadonlySet<string>;
  byCode: ReadonlyMap<string, readonly string[]>;
};

export const CATEGORY_ORDER = [
  '公共基础课程',
  '大类基础课程',
  '大类平台课程',
  '专业基础课程',
  '专业课程',
  '实践环节',
  '其他必修环节',
  '通识教育课程',
  '个性化模块',
  '非限制选修课程',
] as const;

const YEAR_DIGITS = '一二三四五六';
const SMALL_DIGITS = '一二三四五';

const semesterNames = new Map<string, string>(
  Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const label = `大${YEAR_DIGITS[(number - 1) >> 1] ?? ''}${number % 2 ? '上' : '下'}`;
    return [String(number), label] as const;
  }),
);
for (let number = 1; number <= 5; number += 1) {
  semesterNames.set(`S${number}`, `小学期${SMALL_DIGITS[number - 1] ?? ''}`);
}

export const SEMESTER_ORDER = [1, 2, 3, 4, 5, 6].flatMap((year) =>
  [String(year * 2 - 1), String(year * 2), `S${year}`].filter((key) =>
    semesterNames.has(key),
  ),
);

const ANNOTATION_RE =
  /^(?:英|英文|全英|全英文|英语授课|英文授课|全英文授课|双语|双语课|双语教学|双语授课|研讨课|研讨|本研共享|本硕共享|本博共享|本科生研究生共享|拔尖|卓越|教学|分散|通用|创新实践课|含.+|包括.+|[A-Z]|[IVX]+|\d+(?:st|nd|rd|th)?|[一二三四五六七八九十上下中]+|(?:[IVX]+|\d+)[-－—](?:[IVX]+|\d+))$/;

const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return raw === '' ? null : raw;
};

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const formatNormalizedDecimal = (raw: string): string | null => {
  const match = /^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match || ((match[1] ?? '') === '' && match[2] === undefined))
    return null;
  const whole = match[1] ?? '';
  const fraction = match[2] ?? '';
  if (whole === '' && fraction === '') return null;
  const exponent = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (!Number.isFinite(exponent) || Math.abs(exponent) > 10000) return null;
  const digits = `${whole}${fraction}`;
  if (/^0*$/.test(digits)) return '0';
  const lead = digits.match(/^0*/)?.[0].length ?? 0;
  const trimmed = digits.slice(lead);
  const point = whole.length + exponent - lead;
  const trail = trimmed.match(/0*$/)?.[0].length ?? 0;
  const core = trimmed.slice(0, trimmed.length - trail);
  if (point >= core.length) return `${core}${'0'.repeat(point - core.length)}`;
  if (point <= 0) return `0.${'0'.repeat(-point)}${core}`;
  return `${core.slice(0, point)}.${core.slice(point)}`;
};

export const parseSemesters = (value: unknown): string[] => {
  const raw = text(value);
  if (raw === null) return [];
  const found = new Set<string>();
  for (const part of raw.split(',')) {
    const match = /^\s*(S?[1-9]\d*)(?:\s*-\s*(S?[1-9]\d*))?\s*$/.exec(part);
    if (!match?.[1]) throw new Error(`无效开课学期：${JSON.stringify(raw)}`);
    const start = match[1];
    const end = match[2] ?? start;
    if (
      !semesterNames.has(start) ||
      !semesterNames.has(end) ||
      start.startsWith('S') !== end.startsWith('S')
    ) {
      throw new Error(`学期越界或混合区间：${JSON.stringify(raw)}`);
    }
    const first = Number(start.replace(/^S/, ''));
    const last = Number(end.replace(/^S/, ''));
    if (first > last) throw new Error(`学期区间倒序：${JSON.stringify(raw)}`);
    const prefix = start.startsWith('S') ? 'S' : '';
    for (let number = first; number <= last; number += 1) {
      found.add(`${prefix}${number}`);
    }
  }
  return SEMESTER_ORDER.filter((semester) => found.has(semester));
};

export const normalizeCredits = (value: unknown): string | null => {
  const raw = text(value);
  if (raw === null) return null;
  const formatted = DECIMAL_RE.test(raw)
    ? formatNormalizedDecimal(raw.replace(/^[+-]/, ''))
    : null;
  if (formatted === null) throw new Error(`无效总学分：${JSON.stringify(raw)}`);
  if (formatted === '0') return '0';
  if (raw.startsWith('-'))
    throw new Error(`无效总学分：${JSON.stringify(raw)}`);
  return formatted;
};

export const simplifyCourseName = (input: string): string => {
  let name = input
    .trim()
    .replace(/^[*＊]+/u, '')
    .trim();
  let previous = '';
  while (previous !== name) {
    previous = name;
    name = name
      .replace(/[（(]([^（）()]*)[）)]/g, (full, inner: string) => {
        const tag = inner.normalize('NFKC').trim().replace(/\s+/g, '');
        return !tag || ANNOTATION_RE.test(tag) ? '' : full;
      })
      .replace(/\s*[-－—]?\s*\d+(?:st|nd|rd|th)?$/u, '')
      .replace(/\s*[-－—]?\s*[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫＩＶＸ]+$/u, '')
      .replace(/(?<=[\u3400-\u9fff\s）)])[-－—]?\s*[IVX]+$/u, '')
      .trim();
  }
  name = name.replace(/^留学生[\s-]*/u, '');
  name = name.replace(/^文明经典(?:系列)?[AB]?$/u, '文明经典系列');
  return foldCourseName(name.replace(/fourier/giu, 'Fourier'));
};

const codeKey = (code: string | null): [string, number, string, string] => {
  const bare = (code ?? '').replace(/^\*+/, '');
  const match = /^([A-Z]+)(\d+)(.*)$/.exec(bare);
  if (!match?.[1] || match[2] === undefined) return [bare, -1, '', bare];
  return [match[1], Number(match[2]), match[3] ?? '', bare];
};

const compareCode = (left: string | null, right: string | null): number => {
  const a = codeKey(left);
  const b = codeKey(right);
  if (a[0] !== b[0]) return compareText(a[0], b[0]);
  if (a[1] !== b[1]) return a[1] - b[1];
  if (a[2] !== b[2]) return compareText(a[2], b[2]);
  return compareText(a[3], b[3]);
};

const jsonScalar = (value: StoredValue): string =>
  value === null ? 'null' : JSON.stringify(value);

export const canonicalFields = (fields: RawFields): string =>
  `{${Object.keys(fields)
    .sort(compareText)
    .map((key) => `${JSON.stringify(key)}: ${jsonScalar(fields[key] ?? null)}`)
    .join(', ')}}`;

const parseYear = (yearText: string): string => {
  const formatted = DECIMAL_RE.test(yearText)
    ? formatNormalizedDecimal(yearText.replace(/^[+-]/, ''))
    : null;
  const year = formatted === null ? Number.NaN : Number(formatted);
  if (
    yearText.startsWith('-') ||
    formatted === null ||
    formatted.includes('.') ||
    !Number.isSafeInteger(year) ||
    year < 1000 ||
    year > 9999
  ) {
    throw new Error(`无效年级：${JSON.stringify(yearText)}`);
  }
  return String(year);
};

const hasUnsafePageChar = (name: string): boolean =>
  [...name].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return char === '/' || char === '\\' || code <= 0x1f;
  });

const assertPageField = (header: string, name: string): void => {
  if (name === '.' || name === '..' || hasUnsafePageChar(name)) {
    throw new Error(`无效页面路径字段：${header}`);
  }
};

const listMarkdown = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
};

export const courseLinks = (
  pages: Iterable<string>,
  metadata: Metadata,
): CourseLinks => {
  const pageSet = new Set(pages);
  const byCode = new Map<string, string[]>();
  for (const [page, entry] of Object.entries(metadata.courses ?? {})) {
    if (!pageSet.has(page)) continue;
    for (const code of entry.codes) {
      const bare = code.replace(/^\*+/, '');
      const list = byCode.get(bare) ?? [];
      if (!list.includes(page)) list.push(page);
      byCode.set(bare, list);
    }
  }
  return { pages: pageSet, byCode };
};

export const courseLinksFromRepo = (repoRoot: string): CourseLinks => {
  const courseDir = join(repoRoot, 'public/doc/course');
  const pages = listMarkdown(courseDir).map((file) => {
    const rel = relative(courseDir, file)
      .split(sep)
      .join('/')
      .replace(/\.md$/i, '');
    return `/course/${rel}`;
  });
  const metadata = JSON.parse(
    readFileSync(join(repoRoot, 'metadata/course-codes.json'), 'utf8'),
  ) as Metadata;
  return courseLinks(pages, metadata);
};

export const resolveCourse = (
  links: CourseLinks,
  code: string | null,
  name: string | null,
): [string | null, LinkMethod] => {
  if (name) {
    const canonical = `/course/${simplifyCourseName(name)}`;
    if (!links.pages.has(canonical)) return [null, 'unlinked'];
    return [
      canonical,
      canonical === `/course/${name}` ? 'name' : 'simplified_name',
    ];
  }
  const candidates = links.byCode.get((code ?? '').replace(/^\*+/, '')) ?? [];
  const page = candidates[0] ?? null;
  if (candidates.length === 1 && page) return [page, 'code'];
  if (candidates.length > 1) return [null, 'ambiguous_code'];
  return [null, 'unlinked'];
};

const compareRecord = (left: CourseRecord, right: CourseRecord): number => {
  if (left.college !== right.college)
    return compareText(left.college, right.college);
  if (left.major !== right.major) return compareText(left.major, right.major);
  if (left.year !== right.year) return Number(right.year) - Number(left.year);
  const byCode = compareCode(left.code, right.code);
  if (byCode !== 0) return byCode;
  return compareText(
    canonicalFields(left.raw_fields),
    canonicalFields(right.raw_fields),
  );
};

const compareSource = (left: Source, right: Source): number => {
  if (left.file !== right.file) return compareText(left.file, right.file);
  if (left.sheet !== right.sheet) return compareText(left.sheet, right.sheet);
  return left.row - right.row;
};

const countBy = (values: readonly string[]): Record<string, number> =>
  Object.fromEntries(
    [
      ...values.reduce((counts, value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()),
    ].sort(([left], [right]) => compareText(left, right)),
  );

export const cleanRows = (
  rows: Iterable<{ fields: RawFields; source: Source }>,
  links: CourseLinks,
): CleanData => {
  const records = new Map<string, CourseRecord>();
  const inputByFile = new Map<string, number>();
  let inputRows = 0;
  let excluded = 0;
  for (const { fields, source } of rows) {
    inputRows += 1;
    inputByFile.set(source.file, (inputByFile.get(source.file) ?? 0) + 1);
    const majorText = text(fields['专业']);
    if (
      majorText &&
      (majorText.includes('辅修') || majorText.includes('双学位'))
    ) {
      excluded += 1;
      continue;
    }
    try {
      const college = text(fields['学院']);
      const yearText = text(fields['年级']);
      if (college === null) throw new Error('缺少分组字段：学院');
      if (majorText === null) throw new Error('缺少分组字段：专业');
      if (yearText === null) throw new Error('缺少分组字段：年级');
      const year = parseYear(yearText);
      assertPageField('学院', college);
      assertPageField('专业', majorText);
      const code = text(fields['课程代码']);
      const courseName = text(fields['课程名称']);
      const [coursePage, linkMethod] = resolveCourse(links, code, courseName);
      const record: CourseRecord = {
        college,
        major: majorText,
        year,
        level: text(fields['层次']),
        category: text(fields['课程类别']),
        nature: text(fields['课程性质']),
        name: courseName,
        code,
        semester_raw: text(fields['开课学期']),
        remarks: text(fields['备注']),
        total_credits: normalizeCredits(fields['总学分']),
        semesters: parseSemesters(fields['开课学期']),
        course_page: coursePage,
        link_method: linkMethod,
        raw_fields: { ...fields },
        sources: [source],
      };
      const identity = canonicalFields(fields);
      const existing = records.get(identity);
      records.set(
        identity,
        existing
          ? { ...existing, sources: [...existing.sources, source] }
          : record,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${source.file}:${source.row} ${message}`);
    }
  }
  const ordered = [...records.values()]
    .map((record) => ({
      ...record,
      sources: [...record.sources].sort(compareSource),
    }))
    .sort(compareRecord);
  const summary: Summary = {
    files: inputByFile.size,
    input_rows: inputRows,
    input_rows_by_file: Object.fromEntries(
      [...inputByFile.entries()].sort(([left], [right]) =>
        compareText(left, right),
      ),
    ),
    excluded_minor_or_dual_degree: excluded,
    retained_rows: inputRows - excluded,
    duplicate_rows_merged: inputRows - excluded - ordered.length,
    unique_records: ordered.length,
    colleges: new Set(ordered.map((record) => record.college)).size,
    major_pages: new Set(
      ordered.map((record) => `${record.college}\0${record.major}`),
    ).size,
    records_by_year: countBy(ordered.map((record) => record.year)),
    records_by_category: countBy(
      ordered.map((record) => record.category ?? '未注明类别'),
    ),
    records_by_level: countBy(
      ordered.map((record) => record.level ?? '未注明层次'),
    ),
    zero_credits: ordered.filter((record) => record.total_credits === '0')
      .length,
    missing_credits: ordered.filter((record) => record.total_credits === null)
      .length,
    missing_semesters: ordered.filter((record) => record.semesters.length === 0)
      .length,
    multi_semester_records: ordered.filter(
      (record) => record.semesters.length > 1,
    ).length,
    records_with_remarks: ordered.filter((record) => record.remarks !== null)
      .length,
    link_methods: countBy(ordered.map((record) => record.link_method)),
  };
  return { schema_version: 1, summary, records: ordered };
};

export const markdownText = (value: string): string =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/([\\`*_{}[\]()<>#!|~:+\-"'])/g, '\\$1')
    .replace(/\n/g, ' / ');

export const codeSpan = (value: string): string => {
  const flat = value.replace(/\r/g, ' ').replace(/\n/g, ' ');
  const width =
    Math.max(0, ...(flat.match(/`+/g) ?? []).map((run) => run.length)) + 1;
  const delimiter = '`'.repeat(width);
  const padding =
    flat.startsWith('`') ||
    flat.startsWith(' ') ||
    flat.endsWith('`') ||
    flat.endsWith(' ')
      ? ' '
      : '';
  return `${delimiter}${padding}${flat}${padding}${delimiter}`;
};

export const quotePath = (value: string): string =>
  [...value]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code >= 128 || /[A-Za-z0-9/._~-]/.test(char)) return char;
      return Buffer.from(char)
        .toString('hex')
        .toUpperCase()
        .replace(/../g, (byte) => `%${byte}`);
    })
    .join('');

const categoryRank = (category: string): [number, string] => {
  const index = CATEGORY_ORDER.indexOf(
    category as (typeof CATEGORY_ORDER)[number],
  );
  return index === -1 ? [CATEGORY_ORDER.length, category] : [index, ''];
};

const compareCategory = (left: string, right: string): number => {
  const a = categoryRank(left);
  const b = categoryRank(right);
  if (a[0] !== b[0]) return a[0] - b[0];
  return compareText(a[1], b[1]);
};

const compareNature = (left: string, right: string): number => {
  const rank = (value: string): number =>
    value === '必修' ? 0 : value === '选修' ? 1 : 2;
  const byRank = rank(left) - rank(right);
  return byRank === 0 ? compareText(left, right) : byRank;
};

export const renderCourse = (record: CourseRecord): string => {
  const linked = record.course_page
    ? `[${markdownText(record.name ?? '未提供课程名称')}](${quotePath(
        `../../../${record.course_page.replace(/^\//, '')}.md`,
      )})`
    : markdownText(record.name ?? '未提供课程名称');
  const credits =
    record.semesters.length > 1
      ? `总学分 ${record.total_credits ?? '未提供'}`
      : (record.total_credits ?? '未提供');
  return `                * ${linked} - :l-book:${codeSpan(record.code ?? '未提供')} - :l-circle-arrow-up:${codeSpan(credits)}  `;
};

const renderPage = (courses: readonly CourseRecord[]): string => {
  const grouped = new Map<
    string,
    Map<string | null, Map<string, Map<string, CourseRecord[]>>>
  >();
  for (const course of courses) {
    const semesters = course.semesters.length > 0 ? course.semesters : [null];
    for (const semester of semesters) {
      const bySemester = grouped.get(course.year) ?? new Map();
      const byNature = bySemester.get(semester) ?? new Map();
      const nature = course.nature ?? '未注明性质';
      const byCategory = byNature.get(nature) ?? new Map();
      const category = course.category ?? '未注明类别';
      const bucket = byCategory.get(category) ?? [];
      bucket.push(course);
      byCategory.set(category, bucket);
      byNature.set(nature, byCategory);
      bySemester.set(semester, byNature);
      grouped.set(course.year, bySemester);
    }
  }
  const lines = [
    '!!! warning "本培养方案并非实时更新，如果您发现有哪些与[教务网](https://my.cqu.edu.cn)上显示的不符，请通过页面底部的「问题反馈」告知我们"',
    '',
    '---',
    '',
    '## 培养方案  ',
  ];
  for (const year of [...grouped.keys()].sort(
    (a, b) => Number(b) - Number(a),
  )) {
    lines.push(`=== "${year}级"  `);
    const bySemester = grouped.get(year);
    if (!bySemester) continue;
    for (const semester of [...SEMESTER_ORDER, null]) {
      const byNature = bySemester.get(semester);
      if (!byNature) continue;
      const semesterName =
        semester === null
          ? '未注明学期'
          : (semesterNames.get(semester) ?? semester);
      lines.push(`    === "${semesterName}"  `);
      for (const nature of [...byNature.keys()].sort(compareNature)) {
        lines.push(`        === "${markdownText(nature)}"  `);
        const byCategory = byNature.get(nature);
        if (!byCategory) continue;
        for (const category of [...byCategory.keys()].sort(compareCategory)) {
          lines.push(`            * ${markdownText(category)}`);
          const bucket = byCategory.get(category) ?? [];
          for (const course of [...bucket].sort((left, right) => {
            const byCode = compareCode(left.code, right.code);
            return byCode === 0
              ? compareText(
                  canonicalFields(left.raw_fields),
                  canonicalFields(right.raw_fields),
                )
              : byCode;
          })) {
            lines.push(renderCourse(course));
          }
        }
      }
    }
  }
  return `${lines.join('\n')}\n`;
};

export const renderPreviews = (
  records: readonly CourseRecord[],
): Record<string, string> => {
  const pages = new Map<string, CourseRecord[]>();
  for (const record of records) {
    const key = `${record.college}\0${record.major}`;
    const bucket = pages.get(key) ?? [];
    bucket.push(record);
    pages.set(key, bucket);
  }
  return Object.fromEntries(
    [...pages.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, courses]) => {
        const [college = '', major = ''] = key.split('\0');
        return [
          `academic/专业培养方案/${college}/${major}.md`,
          renderPage(courses),
        ];
      }),
  );
};

export const serialize = (data: unknown): string =>
  `${JSON.stringify(data, null, 2)}\n`;
