import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type Bundle,
  cleanRows,
  courseLinksFromRepo,
  REPO_ROOT,
  renderPreviews,
  serialize,
  TOOL_DIR,
} from './clean';
import { readExcelRows } from './excel';

type Format = 'summary' | 'json' | 'markdown';

type CleanArgs = {
  dataDir: string;
  format: Format;
  college?: string;
  major?: string;
  expectRows?: number;
  verifyStable: boolean;
};

export type CleanDeps = {
  buildBundle?: (dataDir: string) => Bundle;
};

const take = (argv: string[], flag: string): string => {
  const value = argv.shift();
  if (value === undefined) throw new Error(`${flag} 缺少参数`);
  return value;
};

const parseArgs = (argv: readonly string[]): CleanArgs => {
  const rest = [...argv];
  let dataDir = join(TOOL_DIR, 'data');
  let format: Format = 'summary';
  let college: string | undefined;
  let major: string | undefined;
  let expectRows: number | undefined;
  let verifyStable = false;
  while (rest.length > 0) {
    const flag = rest.shift();
    if (flag === '--data-dir') dataDir = take(rest, flag);
    else if (flag === '--format') {
      const value = take(rest, flag);
      if (value !== 'summary' && value !== 'json' && value !== 'markdown') {
        throw new Error('--format 只能是 summary、json 或 markdown');
      }
      format = value;
    } else if (flag === '--college') college = take(rest, flag);
    else if (flag === '--major') major = take(rest, flag);
    else if (flag === '--expect-rows') {
      const value = Number(take(rest, flag));
      if (!Number.isInteger(value)) throw new Error('--expect-rows 需要整数');
      expectRows = value;
    } else if (flag === '--verify-stable') verifyStable = true;
    else throw new Error(`未知参数：${flag ?? ''}`);
  }
  if (format === 'markdown' && (!college || !major)) {
    throw new Error('markdown 模式需要 --college 和 --major');
  }
  if (format !== 'markdown' && (college || major)) {
    throw new Error('--college 和 --major 仅用于 markdown 模式');
  }
  return { dataDir, format, college, major, expectRows, verifyStable };
};

export const buildBundle = (
  dataDir = join(TOOL_DIR, 'data'),
  repoRoot = REPO_ROOT,
): Bundle => {
  const data = cleanRows(readExcelRows(dataDir), courseLinksFromRepo(repoRoot));
  return { ...data, markdown_previews: renderPreviews(data.records) };
};

const digest = (bundle: Bundle): string =>
  createHash('sha256').update(serialize(bundle)).digest('hex');

export const main = (argv: readonly string[], deps: CleanDeps = {}): string => {
  const args = parseArgs(argv);
  const build = deps.buildBundle ?? buildBundle;
  const bundle = build(args.dataDir);
  if (
    args.expectRows !== undefined &&
    bundle.summary.input_rows !== args.expectRows
  ) {
    throw new Error(
      `输入总行数不符：预期 ${args.expectRows}，实际 ${bundle.summary.input_rows}`,
    );
  }
  if (args.verifyStable && digest(bundle) !== digest(build(args.dataDir))) {
    throw new Error('重复运行输出不一致');
  }
  if (args.format === 'markdown') {
    const path = `academic/专业培养方案/${args.college}/${args.major}.md`;
    const preview = bundle.markdown_previews[path];
    if (!preview) throw new Error('本次输入中没有指定专业，不读取旧方案补齐');
    return preview;
  }
  return serialize(args.format === 'json' ? bundle : bundle.summary);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.stdout.write(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  }
}
