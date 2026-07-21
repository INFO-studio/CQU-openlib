/** Shared contact channel + value used by contributor block and club form. */

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

export const contactPlaceholder = (kind: '' | ContactKind): string => {
  switch (kind) {
    case 'qq':
      return 'QQ 号';
    case 'wechat':
      return '微信号';
    case 'email':
      return '邮箱地址';
    default:
      return '联系方式';
  }
};

export const contactInputMode = (
  kind: '' | ContactKind,
): 'numeric' | 'email' | undefined => {
  if (kind === 'qq') return 'numeric';
  if (kind === 'email') return 'email';
  return undefined;
};

/** Validate channel + value (both required). */
export const validateContactFields = (
  kind: '' | ContactKind,
  value: string,
): string | null => {
  if (!isContactKind(kind)) return '请选择联系方式类型';
  if (!value.trim()) return `请填写${CONTACT_KIND_LABELS[kind]}`;
  return null;
};
