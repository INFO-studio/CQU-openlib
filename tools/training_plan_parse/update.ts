import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type Bundle,
  type CourseLinks,
  type CourseRecord,
  courseLinksFromRepo,
  quotePath,
  REPO_ROOT,
  renderPreviews,
  serialize,
  simplifyCourseName,
} from './clean';
import { buildBundle } from './cli';

export const placeholder = '---\nplaceholder: course\n---\n';

const frontmatterRe = /^---\n([\s\S]*?)\n---(?:\n|$)\n?/;
const entryRe = /\[((?:\\.|[^\]\\])+)\]\((.+?)\)\s*-\s*:l-book:(`+)(.+?)\3/g;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const escapes = (parent: string, file: string): boolean => {
  const rel = relative(resolve(parent), resolve(file));
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
};

const isInside = (parent: string, file: string): boolean =>
  !escapes(parent, file);

const listMarkdown = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) return listMarkdown(full);
      return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
    })
    .sort(compareText);
};

const unquote = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const courseKey = (file: string): string | null => {
  const marker = '/course/';
  const index = file.indexOf(marker);
  if (index === -1) return null;
  return file.slice(index + marker.length).replace(/\.md$/, '');
};

export const coursePath = (docRoot: string, page: string): string => {
  if (!page.startsWith('/course/')) throw new Error(`无效课程路径：${page}`);
  const target = resolve(docRoot, `${page.slice(1)}.md`);
  if (escapes(resolve(docRoot, 'course'), target)) {
    throw new Error(`课程路径越界：${page}`);
  }
  return target;
};

export const coursePage = (input: string): string => {
  const marked = /（[0-9a-f]{8}）$/.exec(input);
  const preserved =
    (input.includes('／') || input.includes('＼')) && marked
      ? { name: input.slice(0, marked.index), suffix: marked[0] }
      : { name: input, suffix: '' };
  const name = simplifyCourseName(preserved.name);
  const safeName = name.replaceAll('/', '／').replaceAll('\\', '＼');
  if (
    !safeName ||
    safeName === '.' ||
    safeName === '..' ||
    safeName === 'index' ||
    safeName.startsWith('.') ||
    [...safeName].some((char) => char.charCodeAt(0) <= 31)
  ) {
    throw new Error(`无法生成课程文件名：${JSON.stringify(name)}`);
  }
  const suffix =
    safeName === name
      ? preserved.suffix
      : `（${createHash('sha256').update(name).digest('hex').slice(0, 8)}）`;
  return `/course/${safeName}${suffix}`;
};

export const existingBody = (content: string): string =>
  content.replace(frontmatterRe, '');

export const isPlaceholder = (content: string): boolean =>
  !existingBody(content).trim();

export const withPlaceholder = (previous: string): string => {
  const metadata = previous.match(frontmatterRe)?.[1] ?? '';
  const next = /^placeholder:.*$/m.test(metadata)
    ? metadata.replace(/^placeholder:.*$/gm, 'placeholder: course')
    : `${metadata}\nplaceholder: course`.replace(/^\n+/, '');
  return `---\n${next}\n---\n`;
};

export const withUpdated = (
  body: string,
  previous: string,
  updated: string,
): string => {
  const current = (previous.match(frontmatterRe)?.[1] ?? '')
    .replace(/^placeholder:.*\n?/gm, '')
    .trim();
  const metadata = /^updated:.*$/m.test(current)
    ? current.replace(/^updated:.*$/m, `updated: ${updated}`)
    : `${current}\nupdated: ${updated}`.replace(/^\n+/, '');
  return `---\n${metadata}\n---\n\n${body}`;
};

export const completeLinks = (
  records: readonly CourseRecord[],
  links: CourseLinks,
): CourseRecord[] => {
  void links;
  return records.map((record) => {
    if (record.course_page) return record;
    if (!record.name || !record.code) {
      throw new Error('生成课程页需要课程名称和课程号，缺失字段不能推测');
    }
    return { ...record, course_page: coursePage(record.name) };
  });
};

export const obsoletePlaceholders = (docRoot: string): Map<string, string> => {
  const renames = new Map<string, string>();
  for (const file of listMarkdown(resolve(docRoot, 'course'))) {
    const stem = basename(file).replace(/\.md$/i, '');
    if (stem === 'index' || !isPlaceholder(readFileSync(file, 'utf8')))
      continue;
    const target = resolve(
      dirname(file),
      `${coursePage(stem).replace(/^\/course\//, '')}.md`,
    );
    if (target !== file) renames.set(file, target);
  }
  return renames;
};

export const rewriteCourseLinks = (
  content: string,
  renames: ReadonlyMap<string, string>,
): string => {
  const names = new Map<string, string>();
  for (const [oldPath, newPath] of renames) {
    const from = courseKey(oldPath);
    const to = courseKey(newPath);
    if (from && to) names.set(from, to);
  }
  return content.replace(
    /(\]\((?:[^\n)]*?\/)?course\/)([^\n]+?)(\.md(?:#[^\n)]*)?\))/g,
    (full, prefix: string, raw: string, suffix: string) => {
      const next = names.get(unquote(raw));
      return next ? `${prefix}${quotePath(next)}${suffix}` : full;
    },
  );
};

export const prepareUpdates = (
  bundle: Bundle,
  docRoot: string,
  links: CourseLinks,
): Map<string, string> => {
  const records = completeLinks(bundle.records, links);
  const updates = new Map<string, string>(
    Object.entries(renderPreviews(records)).map(([relativePath, body]) => [
      resolve(docRoot, relativePath),
      body,
    ]),
  );
  const renames = obsoletePlaceholders(docRoot);
  const required = new Set<string>(renames.values());
  for (const record of records) {
    if (!record.course_page) {
      throw new Error('生成课程页需要课程名称和课程号，缺失字段不能推测');
    }
    required.add(coursePath(docRoot, record.course_page));
  }
  const planRoot = resolve(docRoot, 'academic/专业培养方案');
  const courseRoot = resolve(docRoot, 'course');
  for (const file of listMarkdown(docRoot)) {
    if (renames.has(file)) continue;
    const previous = readFileSync(file, 'utf8');
    const body = rewriteCourseLinks(
      updates.get(file) ?? existingBody(previous),
      renames,
    );
    if (isInside(planRoot, file)) {
      for (const match of body.matchAll(entryRe)) {
        const href = unquote(match[2] ?? '');
        const course = href.split('/course/')[1];
        if (!href.includes('/course/') || !course) continue;
        required.add(
          coursePath(docRoot, `/course/${course.replace(/\.md$/, '')}`),
        );
      }
    }
    if (isInside(courseRoot, file) && isPlaceholder(previous)) {
      if (previous !== withPlaceholder(previous))
        updates.set(file, placeholder);
    } else if (body !== existingBody(previous)) updates.set(file, body);
  }
  for (const file of [...required].sort(compareText)) {
    if (!existsSync(file) || isPlaceholder(readFileSync(file, 'utf8'))) {
      updates.set(file, placeholder);
    }
  }
  return updates;
};

export const writeUpdates = (
  updates: ReadonlyMap<string, string>,
  updated: string,
): number => {
  let changed = 0;
  for (const [file, body] of [...updates.entries()].sort(([left], [right]) =>
    compareText(left, right),
  )) {
    const previous = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const content =
      body === placeholder
        ? withPlaceholder(previous)
        : existingBody(previous) === body
          ? null
          : withUpdated(body, previous, updated);
    if (content === null || previous === content) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
    changed += 1;
  }
  return changed;
};

export const prunePlaceholders = (
  renames: ReadonlyMap<string, string>,
): number => {
  for (const [oldPath, newPath] of renames) {
    if (
      !existsSync(newPath) ||
      !statSync(newPath).isFile() ||
      !isPlaceholder(readFileSync(oldPath, 'utf8'))
    ) {
      throw new Error(`不能删除课程页：${oldPath}`);
    }
  }
  for (const oldPath of renames.keys()) unlinkSync(oldPath);
  return renames.size;
};

const shanghaiToday = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const assertDate = (value: string): void => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3])
    throw new Error(`无效日期：${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`无效日期：${value}`);
  }
};

const parseArgs = (argv: readonly string[]) => {
  const rest = [...argv];
  let write = false;
  let prune = false;
  let date = shanghaiToday();
  let expectRows: number | undefined;
  while (rest.length > 0) {
    const flag = rest.shift();
    if (flag === '--write') write = true;
    else if (flag === '--prune-placeholders') prune = true;
    else if (flag === '--date') {
      const value = rest.shift();
      if (value === undefined) throw new Error('--date 缺少参数');
      date = value;
    } else if (flag === '--expect-rows') {
      const value = Number(rest.shift());
      if (!Number.isInteger(value)) throw new Error('--expect-rows 需要整数');
      expectRows = value;
    } else throw new Error(`未知参数：${flag ?? ''}`);
  }
  return { write, prune, date, expectRows };
};

export const main = (argv: readonly string[]): string => {
  const args = parseArgs(argv);
  if (args.prune && !args.write)
    throw new Error('--prune-placeholders 需要 --write');
  assertDate(args.date);
  const bundle = buildBundle();
  if (
    args.expectRows !== undefined &&
    bundle.summary.input_rows !== args.expectRows
  ) {
    throw new Error('输入行数不符，未写入站点');
  }
  const docRoot = join(REPO_ROOT, 'public/doc');
  const links = courseLinksFromRepo(REPO_ROOT);
  const renames = obsoletePlaceholders(docRoot);
  const updates = prepareUpdates(bundle, docRoot, links);
  const courseRoot = resolve(docRoot, 'course');
  const summary = {
    ...bundle.summary,
    course_placeholders: [...updates.keys()].filter((file) =>
      isInside(courseRoot, file),
    ).length,
    obsolete_placeholders: renames.size,
    planned_files: updates.size,
  };
  if (!args.write) return serialize(summary);
  const changedFiles = writeUpdates(updates, args.date);
  const removed = args.prune ? prunePlaceholders(renames) : undefined;
  const child = spawnSync('pnpm', ['codes:extract'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (child.status !== 0) throw new Error('pnpm codes:extract 失败');
  return serialize({
    ...summary,
    changed_files: changedFiles,
    ...(removed === undefined ? {} : { removed_placeholders: removed }),
  });
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
