import type { FormType } from '~/admin/lib/api';

export const FORM_TYPE_META: Record<FormType, { label: string; tone: string }> =
  {
    feedback: { label: '页面反馈', tone: '#6aa8c4' },
    textbook: { label: '教材收集', tone: '#6ab59a' },
    upload: { label: '文件上传', tone: '#7a9fd0' },
    club: { label: '社团信息', tone: '#c4a06a' },
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

export const formatShanghai = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
};
