import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { type RawFields, type Source, type StoredValue, text } from './clean';

// 教务导出把 dimension 写成 A1，实际单元格远超这个范围。按单元格读取，不看 dimension。
type SheetCell = StoredValue | boolean;

export type ExcelInput = {
  name: string;
  bytes: Uint8Array;
};

const attr = (tag: string, name: string): string | null =>
  new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

const decodeXml = (value: string): string =>
  value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const inlineText = (inner: string): string => {
  const source = inner.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  return [...source.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('');
};

const columnIndex = (ref: string): number => {
  const letters = /^[A-Z]+/.exec(ref)?.[0];
  if (!letters) throw new Error(`无效单元格引用：${ref}`);
  return (
    [...letters].reduce(
      (index, char) => index * 26 + char.charCodeAt(0) - 64,
      0,
    ) - 1
  );
};

const parseSharedStrings = (xml: string | undefined): string[] => {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map(
    (match) => (match[1] ? inlineText(match[1]) : ''),
  );
};

const numericValue = (raw: string): StoredValue => {
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
    return Number(raw);
  throw new Error(`无法识别的单元格：${raw}`);
};

const parseCell = (
  attributes: string,
  inner: string | null,
  shared: readonly string[],
): SheetCell => {
  if (inner === null) return null;
  const kind = attr(attributes, 't');
  const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner);
  if (formula?.[1] !== undefined) return `=${decodeXml(formula[1])}`;
  if (kind === 'inlineStr') return inlineText(inner);
  const cached = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  if (kind === 's') {
    const index = Number(cached ?? '');
    const value = shared[index];
    if (value === undefined) throw new Error(`共享字符串越界：${index}`);
    return value;
  }
  if (kind === 'b') return cached === '1';
  if (kind === 'str') return cached === undefined ? null : decodeXml(cached);
  if (cached === undefined) return null;
  return numericValue(decodeXml(cached).trim());
};

const parseGrid = (xml: string, shared: readonly string[]): SheetCell[][] => {
  let maxRow = 0;
  let maxCol = 0;
  const placed: { row: number; col: number; value: SheetCell }[] = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(attr(rowMatch[1] ?? '', 'r') ?? '');
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
    maxRow = Math.max(maxRow, rowNumber);
    let nextCol = 0;
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(
      /<c\b([^>/]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g,
    )) {
      const attributes = cellMatch[1] ?? cellMatch[2] ?? '';
      const ref = attr(attributes, 'r');
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      maxCol = Math.max(maxCol, col + 1);
      placed.push({
        row: rowNumber,
        col,
        value: parseCell(
          attributes,
          cellMatch[1] !== undefined ? null : (cellMatch[3] ?? ''),
          shared,
        ),
      });
    }
  }
  const grid = Array.from({ length: maxRow }, () =>
    Array.from({ length: maxCol }, () => null as SheetCell),
  );
  for (const cell of placed) {
    const line = grid[cell.row - 1];
    if (line) line[cell.col] = cell.value;
  }
  return grid;
};

const sheetLocation = (
  workbook: string,
  rels: string,
): { name: string; path: string } => {
  const active = Number(
    /<workbookView\b[^>]*\bactiveTab="(\d+)"/.exec(workbook)?.[1] ?? '0',
  );
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map(
    (match) => ({
      name: decodeXml(attr(match[1] ?? '', 'name') ?? ''),
      id: attr(match[1] ?? '', 'r:id') ?? '',
    }),
  );
  const sheet = sheets[Number.isInteger(active) ? active : 0] ?? sheets[0];
  if (!sheet?.id) throw new Error('缺少可读取的活动工作表');
  const relationships = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(match[1] ?? '', 'Id');
    const target = attr(match[1] ?? '', 'Target');
    if (id && target) relationships.set(id, target);
  }
  const target = relationships.get(sheet.id);
  if (!target) throw new Error(`${sheet.name} 缺少可读取的活动工作表`);
  const normalized = decodeURIComponent(target).replace(/^\//, '');
  return {
    name: sheet.name,
    path: normalized.startsWith('xl/') ? normalized : `xl/${normalized}`,
  };
};

const rowsFromGrid = (
  file: string,
  sheet: string,
  grid: readonly (readonly SheetCell[])[],
): { fields: RawFields; source: Source }[] => {
  const headerRow = grid[1];
  if (!headerRow)
    throw new Error(`${file}:2 表头缺失或重名：${requiredList([])}`);
  const headers = headerRow.map((value) => text(value));
  const named = headers.filter((header): header is string => header !== null);
  const missing = REQUIRED_HEADERS.filter((header) => !named.includes(header));
  if (missing.length > 0 || new Set(named).size !== named.length) {
    throw new Error(`${file}:2 表头缺失或重名：${requiredList(missing)}`);
  }
  return grid.slice(2).flatMap((values, offset) => {
    const rowNumber = offset + 3;
    const width = Math.max(headers.length, values.length);
    const padded = Array.from(
      { length: width },
      (_, col) => values[col] ?? null,
    );
    if (padded.every((value) => value === null)) return [];
    const fields: RawFields = {};
    for (let col = 0; col < width; col += 1) {
      const header = headers[col] ?? null;
      const value = padded[col] ?? null;
      if (header === null) {
        if (value !== null)
          throw new Error(`${file}:${rowNumber} 无表头列含数据`);
        continue;
      }
      if (typeof value === 'boolean') {
        throw new Error(`${file}:${rowNumber} ${header} 含不支持的单元格类型`);
      }
      if (typeof value === 'string' && value.startsWith('=')) {
        throw new Error(
          `${file}:${rowNumber} ${header} 含公式，不能推测计算结果`,
        );
      }
      fields[header] = value;
    }
    return [{ fields, source: { file, sheet, row: rowNumber } }];
  });
};

const REQUIRED_HEADERS = [
  '学院',
  '专业',
  '年级',
  '课程类别',
  '课程性质',
  '课程名称',
  '课程代码',
  '总学分',
  '开课学期',
] as const;

const requiredList = (missing: readonly string[]): string =>
  [...missing].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(', ');

export const readWorkbookRows = (
  file: string,
  bytes: Uint8Array,
): { fields: RawFields; source: Source }[] => {
  const entries = new Map(
    Object.entries(unzipSync(bytes)).map(([name, data]) => [
      name.replace(/^\.\//, ''),
      data,
    ]),
  );
  const workbook = entries.get('xl/workbook.xml');
  const rels = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) throw new Error(`${file} 缺少可读取的活动工作表`);
  const sheet = sheetLocation(strFromU8(workbook), strFromU8(rels));
  const xml = entries.get(sheet.path);
  if (!xml) throw new Error(`${file} 缺少可读取的活动工作表`);
  const shared = parseSharedStrings(
    entries.has('xl/sharedStrings.xml')
      ? strFromU8(entries.get('xl/sharedStrings.xml') ?? new Uint8Array())
      : undefined,
  );
  return rowsFromGrid(file, sheet.name, parseGrid(strFromU8(xml), shared));
};

export const readExcelRowsFromFiles = (
  files: readonly ExcelInput[],
): { fields: RawFields; source: Source }[] => {
  if (files.length === 0) throw new Error('未找到 Excel：virtual');
  return [...files]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((file) => readWorkbookRows(file.name, file.bytes));
};

export const readExcelRows = (
  dataDir: string,
): { fields: RawFields; source: Source }[] => {
  const names = existsSync(dataDir)
    ? readdirSync(dataDir)
        .filter((name) => name.endsWith('.xlsx') && !name.startsWith('~$'))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    : [];
  if (names.length === 0) throw new Error(`未找到 Excel：${dataDir}`);
  return names.flatMap((name) =>
    readWorkbookRows(name, readFileSync(join(dataDir, name))),
  );
};
