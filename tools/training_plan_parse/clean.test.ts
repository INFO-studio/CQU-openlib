import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import {
  type Bundle,
  CATEGORY_ORDER,
  type CleanData,
  type CourseLinks,
  canonicalFields,
  cleanRows,
  courseLinks,
  markdownText,
  normalizeCredits,
  parseSemesters,
  type RawFields,
  REPO_ROOT,
  renderCourse,
  renderPreviews,
  resolveCourse,
  type StoredValue,
  serialize,
  simplifyCourseName,
  TOOL_DIR,
  text,
} from './clean';
import { buildBundle, main } from './cli';
import { readExcelRows, readExcelRowsFromFiles } from './excel';

const HEADERS = [
  '学院',
  '专业',
  '年级',
  '层次',
  '课程类别',
  '课程性质',
  '学科类别',
  '课程名称',
  '课程代码',
  '总学分',
  '总学时',
  '理论学时',
  '实验学时',
  '实践学时',
  '课外学时',
  '开课学期',
  '考核方式',
  '备注',
] as const;

const row = (
  changes: Partial<Record<string, StoredValue>> = {},
): RawFields => ({
  学院: '测试学院',
  专业: '测试专业',
  年级: 2026,
  层次: '本科',
  课程类别: '公共基础课程',
  课程性质: '必修',
  学科类别: null,
  课程名称: '测试课程',
  课程代码: 'TEST100',
  总学分: 2,
  总学时: null,
  理论学时: null,
  实验学时: null,
  实践学时: null,
  课外学时: null,
  开课学期: '1',
  考核方式: null,
  备注: null,
  ...changes,
});

const sourced = (...rows: RawFields[]) =>
  rows.map((fields, index) => ({
    fields,
    source: { file: 'a.xlsx', sheet: 'Sheet', row: index + 3 },
  }));

const clean = (
  rows: RawFields[],
  links: CourseLinks = courseLinks([], {}),
): CleanData => cleanRows(sourced(...rows), links);

const preview = (data: CleanData): string => {
  const value = Object.values(renderPreviews(data.records))[0];
  if (!value) throw new Error('没有预览');
  return value;
};

const columnName = (index: number): string => {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

const xmlText = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const cellXml = (
  rowNumber: number,
  col: number,
  value: StoredValue,
): string => {
  const ref = `${columnName(col)}${rowNumber}`;
  if (value === null) return '';
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  if (value.startsWith('=')) {
    return `<c r="${ref}"><f>${xmlText(value.slice(1))}</f></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
};

const workbookBytes = (
  headers: readonly string[] = HEADERS,
  rows: RawFields[] = [row()],
  extra?: { row: number; col: number; value: string },
): Uint8Array => {
  const lines = [
    `<row r="1">${cellXml(1, 0, '培养方案课程列表')}</row>`,
    `<row r="2">${headers.map((header, col) => cellXml(2, col, header)).join('')}</row>`,
    ...rows.map((fields, index) => {
      const rowNumber = index + 3;
      const cells = headers.map((header, col) =>
        cellXml(rowNumber, col, fields[header] ?? null),
      );
      if (extra?.row === rowNumber)
        cells.push(cellXml(rowNumber, extra.col, extra.value));
      return `<row r="${rowNumber}">${cells.join('')}</row>`;
    }),
  ];
  const sheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1"/><sheetData>${lines.join('')}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Sheet" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>`;
  return zipSync({
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(rels),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  });
};

test('parses semesters and rejects invalid ranges', () => {
  assert.deepEqual(parseSemesters(1), ['1']);
  assert.deepEqual(parseSemesters(' 12 '), ['12']);
  for (const value of [null, '', '  '])
    assert.deepEqual(parseSemesters(value), []);
  assert.deepEqual(parseSemesters('4,1-3,S1-S2,2,S1'), [
    '1',
    '2',
    'S1',
    '3',
    '4',
    'S2',
  ]);
  assert.deepEqual(parseSemesters('6,S3'), ['6', 'S3']);
  assert.deepEqual(parseSemesters('S1,S2,S3'), ['S1', 'S2', 'S3']);
  assert.deepEqual(parseSemesters('10-12,S5'), ['10', 'S5', '11', '12']);
  for (const value of [
    '0',
    '13',
    'S0',
    'S6',
    '4-2',
    'S3-S1',
    'S1-3',
    '1-S2',
    '1-13',
    'S1-S6',
    '1,',
    ',1',
    '1,,2',
    '01',
    's1',
    '1.0',
    '1-2-3',
    '1，2',
    '秋季',
    '1,bad',
  ]) {
    assert.throws(
      () => parseSemesters(value),
      /无效开课学期|学期越界|学期区间倒序/,
    );
  }
});

test('simplifies annotations without truncating core names', () => {
  const cases: Record<string, string> = {
    '人工智能概述(英)': '人工智能概述',
    '传媒调查与统计分析（1）': '传媒调查与统计分析',
    '传媒调查与统计分析（2）': '传媒调查与统计分析',
    '电力系统污秽与覆冰绝缘（研讨课）': '电力系统污秽与覆冰绝缘',
    '计算机辅助翻译（本硕共享）': '计算机辅助翻译',
    '机器学习（本研共享）': '机器学习',
    '中国文化经典（上）（英文）': '中国文化经典',
    '高等数学II-1（全英文）': '高等数学',
    '视听语言Ｉ-2': '视听语言',
    '人体分子与细胞-1st': '人体分子与细胞',
    '人体功能学 - 1': '人体功能学',
    '数智力学项目制课程（二）': '数智力学项目制课程',
    '测试（II－2）（双语课）': '测试',
    '测试（含快题）（拔尖）': '测试',
    '* 测试（（英））': '测试',
    '留学生-初级汉语': '初级汉语',
    文明经典A: '文明经典系列',
  };
  for (const [original, expected] of Object.entries(cases)) {
    assert.equal(simplifyCourseName(original), expected);
    assert.equal(simplifyCourseName(expected), expected);
  }
  for (const name of [
    '专业英语',
    '英语文学',
    '体育心理学',
    '机械CAD',
    '三维CAD',
    '面向对象技术与UML',
    '材料成型CAD/CAE/CAM',
    '程序设计基础（基于C++）',
    '第二外语（日语）',
    '材料专题实验（功能材料）',
    '建筑类设计理论与方法（建筑学）',
    'Co-op项目培训',
    'C++程序设计',
    '3D建模',
    '图形表达与建筑信息模型（BIM）',
  ]) {
    assert.equal(simplifyCourseName(name), name);
  }
});

test('keeps original names while links use core names', () => {
  const originals = ['新课（1）（英）', '新课（2）（本研共享）'];
  const links = courseLinks(['/course/新课'], {});
  const data = clean(
    originals.map((name) => row({ 课程名称: name })),
    links,
  );
  assert.deepEqual(
    data.records.map((record) => record.name),
    originals,
  );
  assert.deepEqual(
    new Set(data.records.map((record) => record.raw_fields['课程名称'])),
    new Set(originals),
  );
  assert.equal(data.summary.unique_records, 2);
  const output = preview(data);
  for (const name of originals)
    assert.match(
      output,
      new RegExp(`\\[${name}\\]\\(\\.\\./\\.\\./\\.\\./course/新课\\.md\\)`),
    );
  assert.equal(clean([row({ 课程名称: '（英）' })]).records[0]?.name, '（英）');
  for (const name of [
    '*高等数学II-1（全英文）',
    '文明经典系列B',
    '人工智能概述(英)',
    '计算机辅助翻译（本硕共享）',
  ]) {
    const record = clean([row({ 课程名称: name })]).records[0];
    if (!record) throw new Error('missing');
    assert.equal(record.name, name);
    assert.ok(renderCourse(record).includes(markdownText(name)));
  }
});

test('normalizes credits and renders missing values', () => {
  assert.equal(normalizeCredits(0), '0');
  assert.equal(normalizeCredits('0.00'), '0');
  assert.equal(normalizeCredits(2.5), '2.5');
  assert.equal(normalizeCredits('2.00'), '2');
  assert.equal(normalizeCredits(null), null);
  assert.equal(normalizeCredits(' '), null);
  for (const value of ['NaN', 'Infinity', '-1', '三', '2学分', true]) {
    assert.throws(() => normalizeCredits(value), /无效总学分/);
  }
  const data = clean([row({ 总学分: 0 }), row({ 总学分: null })]);
  assert.equal(data.summary.zero_credits, 1);
  assert.equal(data.summary.missing_credits, 1);
  const output = preview(data);
  assert.match(output, /:l-circle-arrow-up:`0`/);
  assert.match(output, /:l-circle-arrow-up:`未提供`/);
});

test('retains rows that omit optional fields', () => {
  const data = clean([
    row({
      课程代码: null,
      课程名称: null,
      课程类别: null,
      课程性质: null,
      总学分: null,
      开课学期: null,
    }),
  ]);
  const output = preview(data);
  assert.equal(data.summary.unique_records, 1);
  for (const label of [
    '未注明学期',
    '未注明性质',
    '未注明类别',
    '未提供课程名称',
    ':l-book:`未提供`',
  ]) {
    assert.ok(output.includes(label), label);
  }
  assert.equal(data.records[0]?.total_credits, null);
  assert.deepEqual(data.records[0]?.semesters, []);
});

test('missing identity fields fail with a location', () => {
  for (const field of ['学院', '专业', '年级'] as const) {
    assert.throws(() => clean([row({ [field]: null })]), /a\.xlsx:3/);
  }
  for (const year of ['NaN', '2026.5', '26', '未知']) {
    assert.throws(() => clean([row({ 年级: year })]), /a\.xlsx:3/);
  }
  assert.equal(clean([row({ 年级: 2026 })]).records[0]?.year, '2026');
});

test('filters only minor and dual-degree majors', () => {
  const data = clean([
    row({ 专业: '计算机（辅修）', 总学分: '无效' }),
    row({ 专业: '双学位计算机' }),
    row({ 层次: '研究生' }),
    row({ 层次: '预科' }),
    row({ 层次: null }),
    row({ 层次: '本科' }),
  ]);
  assert.equal(data.summary.input_rows, 6);
  assert.equal(data.summary.excluded_minor_or_dual_degree, 2);
  assert.equal(data.summary.unique_records, 4);
  assert.deepEqual(
    new Set(data.records.map((item) => item.level)),
    new Set(['研究生', '预科', '本科', null]),
  );
});

test('merges exact duplicates and keeps every other variant', () => {
  const data = clean([
    row(),
    row(),
    row({ 备注: '仅限本专业' }),
    row({ 课程性质: '选修' }),
    row({ 课程类别: '大类平台课程' }),
    row({ 总学时: 32 }),
    row({ 层次: '研究生' }),
  ]);
  assert.equal(data.summary.duplicate_rows_merged, 1);
  assert.equal(data.summary.unique_records, 6);
  assert.equal(
    data.records.reduce((sum, item) => sum + item.sources.length, 0),
    7,
  );
  const duplicated = data.records.find(
    (item) => canonicalFields(item.raw_fields) === canonicalFields(row()),
  );
  assert.equal(duplicated?.sources.length, 2);
  assert.ok(data.records.some((item) => item.remarks === '仅限本专业'));
  const output = preview(data);
  assert.equal(output.includes('备注：'), false);
  assert.match(output, /=== "选修"/);
});

test('preserves raw ranges and does not split policy credits', () => {
  const data = clean([
    row({ 课程名称: '形势与政策', 总学分: 2, 开课学期: '1-8' }),
  ]);
  const record = data.records[0];
  assert.equal(record?.semester_raw, '1-8');
  assert.equal(record?.raw_fields['开课学期'], '1-8');
  assert.equal(record?.total_credits, '2');
  const output = preview(data);
  assert.equal(output.split(':l-circle-arrow-up:`总学分 2`').length - 1, 8);
  assert.equal(output.includes('开课范围'), false);
  assert.equal(output.includes('非每学期学分'), false);
  assert.equal(output.includes('0.25'), false);
  assert.match(
    preview(clean([row({ 总学分: null, 开课学期: 'S1-S3' })])),
    /:l-circle-arrow-up:`总学分 未提供`/,
  );
});

test('renders a course collection without extra annotations', () => {
  const links = courseLinks(['/course/思政选修课程集'], {});
  const data = clean(
    [
      row({
        课程名称: '思政选修课程集',
        课程代码: 'IPE',
        开课学期: '2-7',
        备注: '选1门，修2学分',
      }),
    ],
    links,
  );
  const record = data.records[0];
  if (!record) throw new Error('missing');
  assert.equal(record.remarks, '选1门，修2学分');
  assert.equal(record.semester_raw, '2-7');
  assert.equal(
    renderCourse(record),
    '                * [思政选修课程集](../../../course/思政选修课程集.md) - :l-book:`IPE` - :l-circle-arrow-up:`总学分 2`  ',
  );
  assert.equal(preview(data).split('[思政选修课程集]').length - 1, 6);
});

test('renders every category, including unknown ones', () => {
  const categories = [...CATEGORY_ORDER, '新课程类别'];
  const data = clean([
    ...categories.map((category) => row({ 课程类别: category })),
    row({ 课程性质: '限选', 课程类别: '新课程类别' }),
  ]);
  const output = preview(data);
  for (const category of categories)
    assert.ok(output.includes(`* ${category}`));
  assert.match(output, / {8}=== "限选"/);
  assert.equal(
    output.split('                * ').length - 1,
    categories.length + 1,
  );
});

test('does not invent old years and sorts years descending', () => {
  const output = preview(
    clean([
      row({ 年级: 2023 }),
      row({ 年级: 2026 }),
      row({ 年级: 2024 }),
      row({ 年级: 2025 }),
    ]),
  );
  assert.deepEqual(
    [...output.matchAll(/^=== "(\d+)级"/gm)].map((match) => match[1]),
    ['2026', '2025', '2024', '2023'],
  );
  assert.equal(output.includes('2022级'), false);
  assert.equal(preview(clean([row({ 年级: 2026 })])).includes('2023级'), false);
});

test('is deterministic when input order changes', () => {
  const rows = sourced(
    row({ 课程代码: 'A10' }),
    row({ 课程代码: 'A2' }),
    row({ 课程代码: '*A2' }),
    row({ 课程代码: 'A2' }),
    row({ 课程代码: 'A' }),
  );
  const links = courseLinks([], {});
  const original = cleanRows(rows, links);
  const shuffled = cleanRows(
    [rows[4], rows[2], rows[0], rows[3], rows[1]].filter(
      (item) => item !== undefined,
    ),
    links,
  );
  assert.equal(serialize(original), serialize(shuffled));
  assert.deepEqual(
    renderPreviews(original.records),
    renderPreviews(shuffled.records),
  );
  const output = preview(original);
  assert.ok(output.indexOf(':l-book:`A2`') < output.indexOf(':l-book:`A10`'));
});

test('escapes untrusted markdown and rejects unsafe majors', () => {
  const output = preview(
    clean([
      row({
        课程名称: '[课程]<script>',
        课程代码: 'A`B',
        备注: '第一行\n<script>*第二行*',
      }),
    ]),
  );
  assert.match(output, /\\\[课程\\\]\\<script\\>/);
  assert.match(output, /:l-book:``A`B``/);
  assert.equal(output.includes('备注：'), false);
  assert.equal(output.includes('第一行'), false);
  assert.equal(output.includes('<script>'), false);
  for (const major of ['../逃逸', '..', 'a\\b', 'a\nb']) {
    assert.throws(
      () => clean([row({ 专业: major })]),
      /无效页面路径字段|a\.xlsx:3/,
    );
  }
});

test('resolves links by core name before stale codes', () => {
  const links = courseLinks(
    [
      '/course/正确课程',
      '/course/原始名称',
      '/course/英语',
      '/course/高等数学',
      '/course/有 空格(#)',
    ],
    {
      courses: {
        '/course/正确课程': { codes: ['CODE1', 'CONFLICT'] },
        '/course/原始名称': { codes: ['CONFLICT'] },
        '/course/已删除': { codes: ['DELETED'] },
      },
    },
  );
  assert.deepEqual(resolveCourse(links, 'CODE1', '原始名称'), [
    '/course/原始名称',
    'name',
  ]);
  assert.deepEqual(resolveCourse(links, '*CODE1', '其他名称'), [
    null,
    'unlinked',
  ]);
  assert.deepEqual(resolveCourse(links, '*CODE1', null), [
    '/course/正确课程',
    'code',
  ]);
  assert.deepEqual(resolveCourse(links, null, '原始名称'), [
    '/course/原始名称',
    'name',
  ]);
  assert.deepEqual(resolveCourse(links, 'NEW', '大学英语III'), [
    null,
    'unlinked',
  ]);
  assert.deepEqual(resolveCourse(links, 'NEW', '高等数学II-1'), [
    '/course/高等数学',
    'simplified_name',
  ]);
  assert.deepEqual(resolveCourse(links, 'DELETED', '已删除'), [
    null,
    'unlinked',
  ]);
  assert.deepEqual(resolveCourse(links, null, '不存在III'), [null, 'unlinked']);
  assert.deepEqual(resolveCourse(links, 'CONFLICT', '原始名称'), [
    '/course/原始名称',
    'name',
  ]);
  assert.deepEqual(resolveCourse(links, 'CONFLICT', '其他名称'), [
    null,
    'unlinked',
  ]);
  assert.deepEqual(resolveCourse(links, 'CONFLICT', null), [
    null,
    'ambiguous_code',
  ]);
  const record = clean([row()], links).records[0];
  if (!record) throw new Error('missing');
  assert.equal(renderCourse(record).includes(']('), false);
  const spaced = clean([row({ 课程名称: '有 空格(#)' })], links).records[0];
  if (!spaced) throw new Error('missing');
  const rendered = renderCourse(spaced);
  assert.match(rendered, /course\/有%20空格%28%23%29\.md/);
  assert.match(rendered, /:l-book:/);
  assert.match(rendered, /:l-circle-arrow-up:/);
  assert.equal(rendered.includes(':material-'), false);
});

test('reads the second header row and ignores a false A1 dimension', () => {
  const shuffled = [...HEADERS].reverse();
  const rows = readExcelRowsFromFiles([
    { name: 'z.xlsx', bytes: workbookBytes() },
    {
      name: 'a.xlsx',
      bytes: workbookBytes(shuffled, [row({ 总学分: 0, 备注: '保留原文' })]),
    },
  ]);
  assert.deepEqual(
    rows.map((item) => item.source.file),
    ['a.xlsx', 'z.xlsx'],
  );
  assert.equal(rows[0]?.fields['总学分'], 0);
  assert.equal(rows[0]?.fields['备注'], '保留原文');
  assert.equal(rows[0]?.source.row, 3);

  const truncated = readExcelRowsFromFiles([
    {
      name: 'a.xlsx',
      bytes: workbookBytes(HEADERS, [
        row({ 备注: '完整备注' }),
        row({ 课程代码: 'LAST' }),
      ]),
    },
  ]);
  assert.equal(truncated.length, 2);
  assert.equal(truncated[0]?.fields['备注'], '完整备注');
  assert.equal(truncated[1]?.fields['课程代码'], 'LAST');
  assert.equal(truncated[1]?.fields['备注'], null);
});

test('rejects data past the headers, formulas, and broken header rows', () => {
  assert.throws(
    () =>
      readExcelRowsFromFiles([
        {
          name: 'a.xlsx',
          bytes: workbookBytes(HEADERS, [row()], {
            row: 3,
            col: HEADERS.length,
            value: '不可丢弃',
          }),
        },
      ]),
    /无表头列含数据/,
  );
  const optional = HEADERS.filter(
    (header) => header !== '备注' && header !== '层次',
  );
  const data = cleanRows(
    readExcelRowsFromFiles([
      { name: 'a.xlsx', bytes: workbookBytes(optional) },
    ]),
    courseLinks([], {}),
  );
  assert.equal(data.records[0]?.level, null);
  assert.equal(data.records[0]?.remarks, null);
  for (const headers of [
    HEADERS.slice(0, -3).concat(HEADERS.slice(-2)),
    [...HEADERS, '年级'],
  ]) {
    assert.throws(
      () =>
        readExcelRowsFromFiles([
          { name: 'a.xlsx', bytes: workbookBytes(headers) },
        ]),
      /a\.xlsx:2/,
    );
  }
  assert.throws(
    () =>
      readExcelRowsFromFiles([
        {
          name: 'a.xlsx',
          bytes: workbookBytes(HEADERS, [row({ 总学分: '=1+1' })]),
        },
      ]),
    /a\.xlsx:3 总学分 含公式/,
  );
  assert.throws(() => readExcelRowsFromFiles([]), /未找到 Excel/);
  assert.throws(
    () => readExcelRows(join(TOOL_DIR, 'missing-data')),
    /未找到 Excel/,
  );
});

test('prints summary, json, or one markdown preview', () => {
  const data = clean([row()]);
  const bundle: Bundle = {
    ...data,
    markdown_previews: renderPreviews(data.records),
  };
  assert.deepEqual(
    JSON.parse(main([], { buildBundle: () => bundle })),
    bundle.summary,
  );
  assert.deepEqual(
    JSON.parse(main(['--format', 'json'], { buildBundle: () => bundle })),
    bundle,
  );
  assert.equal(
    main(
      ['--format', 'markdown', '--college', '测试学院', '--major', '测试专业'],
      {
        buildBundle: () => bundle,
      },
    ),
    preview(bundle),
  );
  assert.throws(() =>
    main(['--expect-rows', '2'], { buildBundle: () => bundle }),
  );
  assert.throws(() =>
    main(
      ['--format', 'markdown', '--college', '测试学院', '--major', '旧专业'],
      {
        buildBundle: () => bundle,
      },
    ),
  );
  const changed: Bundle = {
    ...bundle,
    markdown_previews: { changed: 'changed' },
  };
  let calls = 0;
  assert.throws(() =>
    main(['--verify-stable'], {
      buildBundle: () => {
        calls += 1;
        return calls === 1 ? bundle : changed;
      },
    }),
  );
});

const filesUnder = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.isFile() ? [full] : [];
  });
};

test('reads all four workbooks without writing the site', () => {
  const protectedFiles = [
    ...readdirSync(join(TOOL_DIR, 'data'))
      .filter((name) => name.endsWith('.xlsx'))
      .map((name) => join(TOOL_DIR, 'data', name)),
    ...filesUnder(join(REPO_ROOT, 'public/doc')),
    join(REPO_ROOT, 'metadata/course-codes.json'),
  ].sort();
  const fingerprint = (files: readonly string[]) =>
    Object.fromEntries(
      files.map((file) => [
        file,
        createHash('sha256').update(readFileSync(file)).digest('hex'),
      ]),
    );
  const before = fingerprint(protectedFiles);
  const bundle = buildBundle();
  const summary = bundle.summary;
  assert.equal(summary.files, 4);
  assert.equal(summary.input_rows, 46327);
  assert.deepEqual(
    new Set(Object.keys(summary.records_by_year)),
    new Set(['2023', '2024', '2025', '2026']),
  );
  assert.equal(
    summary.input_rows,
    summary.excluded_minor_or_dual_degree +
      summary.duplicate_rows_merged +
      summary.unique_records,
  );
  assert.equal(
    bundle.records.reduce((sum, record) => sum + record.sources.length, 0),
    summary.retained_rows,
  );
  assert.deepEqual(
    new Set(Object.keys(summary.records_by_category)),
    new Set(CATEGORY_ORDER),
  );
  assert.ok((summary.records_by_level['研究生'] ?? 0) > 0);
  assert.ok(summary.zero_credits > 0);
  assert.ok(summary.missing_credits > 0);
  assert.ok(summary.missing_semesters > 0);
  const expected = new Map<string, number>();
  for (const record of bundle.records) {
    assert.equal(record.major.includes('辅修'), false);
    assert.equal(record.major.includes('双学位'), false);
    assert.equal(record.name, text(record.raw_fields['课程名称']));
    assert.equal(
      record.total_credits,
      normalizeCredits(record.raw_fields['总学分']),
    );
    if (record.course_page) {
      const page = join(
        REPO_ROOT,
        'public/doc',
        `${record.course_page.slice(1)}.md`,
      );
      assert.equal(statSync(page).isFile(), true);
    }
    const line = renderCourse(record);
    expected.set(
      line,
      (expected.get(line) ?? 0) + Math.max(1, record.semesters.length),
    );
  }
  const actual = new Map<string, number>();
  for (const content of Object.values(bundle.markdown_previews)) {
    for (const line of content.split('\n')) {
      if (!line.startsWith('                * ')) continue;
      actual.set(line, (actual.get(line) ?? 0) + 1);
    }
  }
  assert.equal(actual.size, expected.size);
  for (const [line, count] of expected) assert.equal(actual.get(line), count);
  for (const [relativePath, content] of Object.entries(
    bundle.markdown_previews,
  )) {
    for (const match of content.matchAll(/\]\(([^\n]+?)\)/g)) {
      const target = match[1] ?? '';
      if (!target.startsWith('../../../course/')) continue;
      const path = resolve(
        REPO_ROOT,
        'public/doc',
        relativePath,
        '..',
        decodeURIComponent(target),
      );
      assert.equal(statSync(path).isFile(), true, target);
    }
  }
  const digest = createHash('sha256').update(serialize(bundle)).digest('hex');
  const again = buildBundle();
  assert.equal(
    digest,
    createHash('sha256').update(serialize(again)).digest('hex'),
  );
  assert.deepEqual(before, fingerprint(protectedFiles));
});
