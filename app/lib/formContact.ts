import { match } from 'ts-pattern';

export const CONTACT_KINDS = ['qq', 'wechat', 'email'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_KIND_OPTIONS = [
  { value: 'qq', label: 'QQ' },
  { value: 'wechat', label: '微信' },
  { value: 'email', label: '邮箱' },
] as const satisfies readonly { value: ContactKind; label: string }[];

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  qq: 'QQ',
  wechat: '微信',
  email: '邮箱',
};

export const isContactKind = (value: unknown): value is ContactKind =>
  typeof value === 'string' &&
  (CONTACT_KINDS as readonly string[]).includes(value);

export const contactPlaceholder = (kind: '' | ContactKind): string =>
  match(kind)
    .with('qq', () => 'QQ 号')
    .with('wechat', () => '微信号')
    .with('email', () => '邮箱地址')
    .otherwise(() => '联系方式');

export const contactInputMode = (
  kind: '' | ContactKind,
): 'numeric' | 'email' | undefined => {
  if (kind === 'qq') return 'numeric';
  if (kind === 'email') return 'email';
  return undefined;
};

export const validateContactFields = (
  kind: '' | ContactKind,
  value: string,
): string | null => {
  if (!isContactKind(kind)) return '请选择联系方式类型';
  if (!value.trim()) return `请填写${CONTACT_KIND_LABELS[kind]}`;
  return null;
};
