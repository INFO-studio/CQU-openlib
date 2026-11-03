import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  type Bundle,
  type CourseLinks,
  cleanRows,
  courseLinks,
  type RawFields,
  renderCourse,
  renderPreviews,
  type StoredValue,
} from './clean';
import {
  completeLinks,
  coursePage,
  coursePath,
  existingBody,
  obsoletePlaceholders,
  placeholder,
  prepareUpdates,
  prunePlaceholders,
  rewriteCourseLinks,
  withUpdated,
  writeUpdates,
} from './update';

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

const clean = (rows: RawFields[], links: CourseLinks = courseLinks([], {})) =>
  cleanRows(
    rows.map((fields, index) => ({
      fields,
      source: { file: 'a.xlsx', sheet: 'Sheet', row: index + 3 },
    })),
    links,
  );

const bundleOf = (data: ReturnType<typeof clean>): Bundle => ({
  ...data,
  markdown_previews: renderPreviews(data.records),
});

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'plans-'));

test('sports links merge without changing display names', () => {
  const links = courseLinks(
    ['/course/体育', '/course/大学体育核心素质课', '/course/体育心理学'],
    {},
  );
  for (const name of [
    '大学体育核心素质课',
    '大学体育核心素质课（1）（英）',
    '体育自选项目1',
    '体育自选项目2',
    '体育自选项目3',
    '体育基础（1）',
    '体育概论',
    '学校体育学',
    '体育专业英语（1）',
  ]) {
    const record = clean([row({ 课程名称: name })], links).records[0];
    if (!record) throw new Error(name);
    assert.equal(record.name, name);
    assert.equal(record.course_page, '/course/体育');
    assert.equal(record.raw_fields['课程名称'], name);
    assert.equal(coursePage(name), '/course/体育');
    assert.match(
      renderCourse(record),
      new RegExp(`\\[${name}\\]\\(\\.\\./\\.\\./\\.\\./course/体育\\.md\\)`),
    );
  }
  for (const name of ['体育心理学', '体育心理学（英）']) {
    const record = clean([row({ 课程名称: name })], links).records[0];
    assert.equal(record?.name, name);
    assert.equal(record?.course_page, '/course/体育心理学');
  }
  const root = tempDir();
  try {
    const old = join(root, 'course/大学体育核心素质课.md');
    mkdirSync(join(root, 'course'), { recursive: true });
    writeFileSync(old, placeholder);
    const target = join(root, 'course/体育.md');
    writeFileSync(target, '## 资源\n体育资料\n');
    assert.deepEqual([...obsoletePlaceholders(root)], [[old, target]]);
    const physics = join(root, 'course/大学物理.md');
    writeFileSync(physics, '## 资源\n大学物理资料\n');
    const folded = [
      '大学物理（电气信息类）',
      '大学物理（工程能源类）',
      '大学物理（化工类）',
      '大学物理（环化健康类）',
    ].map((name) => {
      const file = join(root, `course/${name}.md`);
      writeFileSync(file, placeholder);
      return [file, physics];
    });
    assert.deepEqual(
      [...obsoletePlaceholders(root)].sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
      [[old, target], ...folded].sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('placeholder pages use one core name for every variant', () => {
  const data = clean([
    row({ 课程名称: '新课程I', 课程代码: 'N1' }),
    row({ 课程名称: '新课程II（英）', 课程代码: 'N2' }),
  ]);
  const records = completeLinks(data.records, courseLinks([], {}));
  assert.deepEqual(
    new Set(records.map((record) => record.course_page)),
    new Set(['/course/新课程']),
  );
  assert.deepEqual(
    new Set(records.map((record) => record.code)),
    new Set(['N1', 'N2']),
  );
  assert.deepEqual(
    new Set(records.map((record) => record.name)),
    new Set(['新课程I', '新课程II（英）']),
  );
});

test('a conflicting code keeps the exact name and does not pick a winner', () => {
  const links = courseLinks(['/course/甲', '/course/乙'], {
    courses: {
      '/course/甲': { codes: ['X'] },
      '/course/乙': { codes: ['X'] },
    },
  });
  const data = clean([row({ 课程名称: '乙', 课程代码: 'X' })], links);
  assert.equal(
    completeLinks(data.records, links)[0]?.course_page,
    '/course/乙',
  );
});

test('dirty metadata does not recreate a dirty page', () => {
  const links = courseLinks(['/course/新课程（英）'], {
    courses: { '/course/新课程（英）': { codes: ['N1'] } },
  });
  const data = clean(
    [row({ 课程名称: '新课程（英）', 课程代码: 'N1' })],
    links,
  );
  assert.equal(
    completeLinks(data.records, links)[0]?.course_page,
    '/course/新课程',
  );
});

test('course paths stay inside the course directory', () => {
  const data = clean([row({ 课程名称: '甲/乙' }), row({ 课程名称: '甲／乙' })]);
  const pages = new Set(
    completeLinks(data.records, courseLinks([], {})).map(
      (record) => record.course_page,
    ),
  );
  assert.equal(pages.size, 2);
  assert.throws(() => coursePath('/tmp/docs', '/course/../../escape'));
  for (const name of ['', '（英）', '.隐藏', '..', 'index', '甲\n乙']) {
    assert.throws(() => coursePage(name), /无法生成课程文件名/);
  }
  for (const name of [
    '专业实习（校内／校外）（06981589）',
    'UI／UX设计（55d683c5）',
  ]) {
    assert.equal(coursePage(name), `/course/${name}`);
  }
});

test('writes are idempotent and do not replace real resources', () => {
  const root = tempDir();
  try {
    const course = join(root, 'course/已有.md');
    mkdirSync(join(root, 'course'), { recursive: true });
    writeFileSync(course, '## 资源\n已有教材\n');
    const oldPlan = join(root, 'academic/专业培养方案/旧学院/旧专业.md');
    mkdirSync(join(root, 'academic/专业培养方案/旧学院'), { recursive: true });
    const oldContent =
      '* [遗留（1）（英）](../../../course/遗留.md) - :l-book:`OLD1`\n';
    writeFileSync(oldPlan, oldContent);
    const links = courseLinks(['/course/已有'], {});
    const data = clean(
      [row({ 课程名称: '已有' }), row({ 课程名称: '新课', 课程代码: 'NEW' })],
      links,
    );
    const pending = prepareUpdates(bundleOf(data), root, links);
    assert.equal(pending.has(course), false);
    assert.equal(pending.has(oldPlan), false);
    assert.equal(pending.has(join(root, 'course/遗留.md')), true);
    assert.equal(pending.has(join(root, 'course/新课.md')), true);
    assert.ok(writeUpdates(pending, '2026-09-15') > 0);
    assert.equal(writeUpdates(pending, '2026-09-16'), 0);
    assert.equal(readFileSync(oldPlan, 'utf8'), oldContent);
    assert.equal(readFileSync(course, 'utf8'), '## 资源\n已有教材\n');
    assert.equal(
      readFileSync(join(root, 'course/新课.md'), 'utf8'),
      placeholder,
    );
    assert.equal(placeholder.includes('updated:'), false);
    assert.equal(placeholder.includes(':l-book:'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('migrates placeholders and preserves pages that already have content', () => {
  const root = tempDir();
  try {
    const courses = join(root, 'course');
    mkdirSync(courses);
    const old = join(courses, '新课（1）（英）.md');
    writeFileSync(old, placeholder);
    const canonical = join(courses, '新课.md');
    writeFileSync(canonical, '## 资源\n实际教材\n');
    const empty = join(courses, '空课.md');
    writeFileSync(empty, '');
    const oldStyle = join(courses, '旧占位.md');
    writeFileSync(
      oldStyle,
      '---\nupdated: 2020-01-01\nplaceholder: course\n---\n',
    );
    const partial = join(courses, '另一门（2）.md');
    writeFileSync(partial, `${placeholder}\n已知教材：《书名》\n`);
    const oldPlan = join(root, 'academic/专业培养方案/旧学院/旧专业.md');
    mkdirSync(join(root, 'academic/专业培养方案/旧学院'), { recursive: true });
    writeFileSync(
      oldPlan,
      '* [新课（1）（英）](../../../course/新课（1）（英）.md) - :l-book:`N1`\n',
    );
    const article = join(root, '引用.md');
    writeFileSync(
      article,
      '[新课](course/新课（1）（英）.md)\n[旧课](../course/新课%EF%BC%881%EF%BC%89%EF%BC%88英%EF%BC%89.md#资源)\n',
    );
    const links = courseLinks(['/course/新课'], {});
    const data = clean([row({ 课程名称: '新课（2）', 课程代码: 'N2' })], links);
    const renames = obsoletePlaceholders(root);
    assert.deepEqual([...renames], [[old, canonical]]);
    writeUpdates(prepareUpdates(bundleOf(data), root, links), '2026-09-15');
    assert.equal(prunePlaceholders(renames), 1);
    assert.equal(exists(old), false);
    assert.equal(readFileSync(canonical, 'utf8'), '## 资源\n实际教材\n');
    assert.match(readFileSync(partial, 'utf8'), /已知教材/);
    assert.equal(readFileSync(empty, 'utf8'), placeholder);
    assert.equal(
      readFileSync(oldStyle, 'utf8'),
      '---\nupdated: 2020-01-01\nplaceholder: course\n---\n',
    );
    assert.match(
      readFileSync(oldPlan, 'utf8'),
      /\[新课（1）（英）\]\(\.\.\/\.\.\/\.\.\/course\/新课\.md\)/,
    );
    const articleText = readFileSync(article, 'utf8');
    assert.match(articleText, /\[新课\]\(course\/新课\.md\)/);
    assert.match(articleText, /\.\.\/course\/新课\.md#资源/);
    assert.equal(
      writeUpdates(prepareUpdates(bundleOf(data), root, links), '2026-09-16'),
      0,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const exists = (file: string): boolean => {
  try {
    readFileSync(file);
    return true;
  } catch {
    return false;
  }
};

test('nested placeholders keep their directory', () => {
  const root = tempDir();
  try {
    const old = join(root, 'course/非限课/基础德语（1）.md');
    mkdirSync(join(root, 'course/非限课'), { recursive: true });
    writeFileSync(old, placeholder.trimEnd());
    const plain = join(root, 'course/非限课/其他课.md');
    writeFileSync(plain, placeholder.trimEnd());
    const renames = obsoletePlaceholders(root);
    const target = join(root, 'course/非限课/基础德语.md');
    assert.deepEqual([...renames], [[old, target]]);
    assert.equal(
      rewriteCourseLinks(
        '[德语](../../../course/非限课/基础德语（1）.md)',
        renames,
      ),
      '[德语](../../../course/非限课/基础德语.md)',
    );
    writeUpdates(
      prepareUpdates(bundleOf(clean([row()])), root, courseLinks([], {})),
      '2026-09-15',
    );
    assert.equal(readFileSync(plain, 'utf8'), placeholder);
    assert.equal(readFileSync(target, 'utf8'), placeholder);
    prunePlaceholders(renames);
    assert.equal(obsoletePlaceholders(root).size, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('prune refuses changed content and a missing target', () => {
  const root = tempDir();
  try {
    const old = join(root, '旧.md');
    const created = join(root, '新.md');
    writeFileSync(old, placeholder);
    assert.throws(() => prunePlaceholders(new Map([[old, created]])));
    writeFileSync(created, placeholder);
    writeFileSync(old, '用户刚补充了资源');
    assert.throws(() => prunePlaceholders(new Map([[old, created]])));
    assert.equal(readFileSync(old, 'utf8'), '用户刚补充了资源');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('frontmatter keeps title and drops the placeholder flag when content is real', () => {
  const previous =
    '---\ntitle: 标题\ndescription: 描述\nupdated: 2020-01-01\n---\n\n旧正文';
  const updated = withUpdated('新正文', previous, '2026-09-15');
  assert.match(updated, /title: 标题\ndescription: 描述/);
  assert.match(updated, /updated: 2026-09-15/);
  assert.equal(existingBody(updated), '新正文');
  const replaced = withUpdated(
    '## 资源\n真实内容\n',
    '---\nupdated: 2020-01-01\nplaceholder: course\n---\n',
    '2026-09-24',
  );
  assert.equal(replaced.includes('placeholder:'), false);
  assert.match(replaced, /updated: 2026-09-24/);
  assert.equal(existingBody(replaced), '## 资源\n真实内容\n');
});
