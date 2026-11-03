import { match } from 'ts-pattern';
import type { Submission } from './types';

/** Same words the admin submissions page uses. */
const TYPE_LABELS: Record<string, string> = {
  feedback: '页面反馈',
  textbook: '教材收集',
  upload: '文件上传',
  club: '社团信息',
  group: '学生团体',
};

const STATUS_LABELS: Record<string, string> = {
  pending_confirm: '等待确认',
  pending_change: '等待变更',
  invalid: '表单无效',
  blocked: '暂时阻塞',
  completed: '变更完成',
};

const FIELD_LABELS: Record<string, string> = {
  content: '问题说明',
  credit: '贡献者署名',
  authorCredit: '原作者署名',
  canContact: '可否联系',
  contactKind: '联系渠道',
  contact: '联系方式',
  page: '相关页面',
  year: '入学学年',
  college: '学院',
  major: '专业',
  course: '课程名',
  courseCode: '课程号',
  books: '教材列表',
  name: '名称',
  kind: '类型',
  editor: '主编',
  publisher: '出版社',
  isbn: 'ISBN',
  hasHd: '有高清资源',
  file: '文件',
  category: '贡献类别',
  examKind: '试卷种类',
  examKindOther: '试卷种类注明',
  purpose: '用途',
  confirmAuthorized: '课件授权确认',
  confirmNoPii: '无敏感信息确认',
  introKind: '介绍方式',
  introText: '介绍正文',
  introFile: '介绍文件',
  affiliation: '社团所属',
  updateKind: '更新类型',
  changeType: '变动类型',
  formerName: '原社团名',
  recruitGroup: '纳新群号',
  intro: '简介',
  qqGroup: 'QQ 群号',
  key: '对象键',
  size: '大小',
};

const CATEGORY_LABELS: Record<string, string> = {
  textbook: '教材',
  exam: '试卷',
  slides: '课件',
  notes: '笔记',
  other: '其他',
};

/** Question order on each form. Keys absent from a payload stay absent. */
const FIELD_ORDER: Record<string, readonly string[]> = {
  feedback: [
    'content',
    'page',
    'credit',
    'authorCredit',
    'introKind',
    'introText',
    'introFile',
    'canContact',
    'contactKind',
    'contact',
  ],
  textbook: [
    'year',
    'college',
    'major',
    'course',
    'courseCode',
    'books',
    'credit',
    'authorCredit',
    'introKind',
    'introText',
    'introFile',
    'canContact',
    'contactKind',
    'contact',
  ],
  upload: [
    'category',
    'courseCode',
    'examKind',
    'examKindOther',
    'purpose',
    'confirmAuthorized',
    'confirmNoPii',
    'file',
    'credit',
    'authorCredit',
    'introKind',
    'introText',
    'introFile',
    'canContact',
    'contactKind',
    'contact',
    'page',
  ],
  club: [
    'name',
    'affiliation',
    'updateKind',
    'changeType',
    'formerName',
    'recruitGroup',
    'intro',
    'contactKind',
    'contact',
  ],
  group: ['name', 'intro', 'qqGroup', 'contactKind', 'contact'],
};

const SUMMARY_KEYS: Record<string, readonly string[]> = {
  feedback: ['content', 'page'],
  textbook: ['course', 'courseCode'],
  upload: ['courseCode', 'purpose', 'credit'],
  club: ['name'],
  group: ['name'],
};

const FALLBACK_KEYS = ['name', 'title', 'course', 'content', 'intro'] as const;

const typeLabel = (type: string): string => TYPE_LABELS[type] ?? type;
export const statusLabel = (status: string): string =>
  STATUS_LABELS[status] ?? status;
const fieldLabel = (key: string): string => FIELD_LABELS[key] ?? key;

const textOf = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const isEmpty = (value: unknown): boolean => {
  if (value == null || value === '') return true;
  return Array.isArray(value) && value.length === 0;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const formatBytes = (n: unknown): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const formatScalar = (key: string, value: unknown): string => {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (key === 'size') return formatBytes(value);
  return match(key)
    .with('canContact', 'hasHd', () =>
      match(value)
        .with('yes', () => '是')
        .with('no', () => '否')
        .otherwise(() => String(value)),
    )
    .with('contactKind', () =>
      match(value)
        .with('qq', () => 'QQ')
        .with('wechat', () => '微信')
        .with('email', () => '邮箱')
        .otherwise(() => String(value)),
    )
    .with('confirmAuthorized', 'confirmNoPii', () =>
      value === 'yes' ? '已确认' : String(value),
    )
    .with('category', () =>
      typeof value === 'string'
        ? (CATEGORY_LABELS[value] ?? value)
        : String(value),
    )
    .with('introKind', () =>
      match(value)
        .with('text', () => '纯文字')
        .with('file', () => '上传文件')
        .otherwise(() => String(value)),
    )
    .with('updateKind', () =>
      match(value)
        .with('change', () => '社团变动')
        .with('recruit', () => '纳新群号')
        .with('intro', () => '社团简介')
        .otherwise(() => String(value)),
    )
    .with('changeType', () =>
      match(value)
        .with('join', () => '新社团加入')
        .with('rename', () => '社团更名')
        .with('dissolve', () => '社团解散')
        .otherwise(() => String(value)),
    )
    .otherwise(() => String(value));
};

const indent = (text: string, depth: number): string => {
  const pad = '  '.repeat(depth);
  return text
    .split('\n')
    .map((line) => (line ? `${pad}${line}` : line))
    .join('\n');
};

const renderEntries = (
  entries: readonly (readonly [string, unknown])[],
  skipEmpty: boolean,
): string =>
  entries
    .filter(([, value]) => !skipEmpty || !isEmpty(value))
    .map(
      ([key, value]) =>
        `${fieldLabel(key)}\n${indent(renderValue(key, value), 1)}`,
    )
    .join('\n');

const renderFile = (value: Record<string, unknown>): string =>
  [
    String(value.name ?? '未命名'),
    `对象键  ${String(value.key ?? '—')}`,
    `大小  ${formatBytes(value.size)}`,
  ].join('\n');

const renderBooks = (books: readonly unknown[]): string =>
  books
    .map((book, index) => {
      if (!isPlainObject(book)) return `${index + 1}. ${String(book)}`;
      const title = textOf(book.name) || '未命名';
      const body = renderEntries(
        Object.entries(book).filter(([key]) => key !== 'name'),
        false,
      );
      return body
        ? `${index + 1}. ${title}\n${indent(body, 1)}`
        : `${index + 1}. ${title}`;
    })
    .join('\n');

const renderValue = (key: string, value: unknown): string => {
  if ((key === 'file' || key === 'introFile') && isPlainObject(value)) {
    return renderFile(value);
  }
  if (key === 'books' && Array.isArray(value)) return renderBooks(value);
  if (isPlainObject(value)) return renderEntries(Object.entries(value), false);
  if (Array.isArray(value)) return JSON.stringify(value, null, 2);
  return formatScalar(key, value);
};

const orderedEntries = (
  type: string,
  payload: Record<string, unknown>,
): [string, unknown][] => {
  const order = FIELD_ORDER[type] ?? [];
  const ranked = order.flatMap((key) =>
    Object.hasOwn(payload, key)
      ? [[key, payload[key]] as [string, unknown]]
      : [],
  );
  const rest = Object.entries(payload).filter(([key]) => !order.includes(key));
  return [...ranked, ...rest];
};

export const formatShanghai = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
};

export const submissionSummary = (item: Submission): string => {
  const keys = SUMMARY_KEYS[item.type] ?? FALLBACK_KEYS;
  const summary =
    keys.map((key) => textOf(item.payload[key])).find(Boolean) ||
    Object.values(item.payload).map(textOf).find(Boolean) ||
    '';
  return summary ? summary.replace(/\s+/g, ' ') : '无可预览字段';
};

const oneLine = (value: string, max = 72): string => {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export const formatListLine = (item: Submission): string =>
  [
    formatShanghai(item.createdAt),
    typeLabel(item.type),
    statusLabel(item.status),
    oneLine(submissionSummary(item)),
    item.id,
  ].join('  ');

export const formatSubmission = (item: Submission): string => {
  const head = [
    `${typeLabel(item.type)} · ${statusLabel(item.status)} · ${formatShanghai(item.createdAt)}`,
    `id  ${item.id}`,
    item.completionNote ? `完成备注  ${item.completionNote}` : '',
    item.completedAt ? `完成于  ${formatShanghai(item.completedAt)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const body = renderEntries(orderedEntries(item.type, item.payload), true);
  const meta = [`ipHash  ${item.ipHash ?? '—'}`, `ua  ${item.ua ?? '—'}`].join(
    '\n',
  );
  return [head, body || '这条提交没有填写任何字段', meta].join('\n\n');
};
