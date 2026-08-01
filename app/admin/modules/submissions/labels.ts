import type { FormType, SubmissionItem } from '~/admin/lib/api';
import { statusLabel } from '~/admin/lib/status';

export const FORM_TYPE_META: Record<FormType, { label: string; tone: string }> =
  {
    feedback: { label: '页面反馈', tone: '#6aa8c4' },
    textbook: { label: '教材收集', tone: '#6ab59a' },
    upload: { label: '文件上传', tone: '#7a9fd0' },
    club: { label: '社团信息', tone: '#c4a06a' },
    group: { label: '学生团体', tone: '#a08bc4' },
  };

export const typeLabel = (type: string): string =>
  FORM_TYPE_META[type as FormType]?.label ?? type;

export const typeTone = (type: string): string =>
  FORM_TYPE_META[type as FormType]?.tone ?? '#8a909c';

/** Human labels for known payload keys. Unknown keys fall back to the raw key. */
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

export const fieldLabel = (key: string): string => FIELD_LABELS[key] ?? key;

export const CATEGORY_LABELS: Record<string, string> = {
  textbook: '教材',
  exam: '试卷',
  slides: '课件',
  notes: '笔记',
  other: '其他',
};

export const formatBytes = (n: unknown): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Fields that read best as a one-line preview, in priority order per type. */
const SUMMARY_KEYS: Record<string, readonly string[]> = {
  feedback: ['content', 'page'],
  textbook: ['course', 'courseCode'],
  upload: ['courseCode', 'purpose', 'credit'],
  club: ['name'],
  group: ['name'],
};

const FALLBACK_KEYS = ['name', 'title', 'course', 'content', 'intro'] as const;

/** One scannable line per row, so triage rarely needs an open. */
export const submissionSummary = (item: SubmissionItem): string => {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const keys = SUMMARY_KEYS[item.type] ?? FALLBACK_KEYS;
  for (const key of keys) {
    const value = text(payload[key]);
    if (value) return value.replace(/\s+/g, ' ');
  }
  for (const value of Object.values(payload)) {
    const found = text(value);
    if (found) return found.replace(/\s+/g, ' ');
  }
  return '无可预览字段';
};

/** Lowercased haystack for the rail search box. */
export const submissionSearchText = (item: SubmissionItem): string =>
  [
    item.id,
    typeLabel(item.type),
    statusLabel(item.status),
    item.completionNote ?? '',
    JSON.stringify(item.payload ?? {}),
  ]
    .join(' ')
    .toLowerCase();
