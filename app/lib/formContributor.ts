/** Shared contributor / contact draft fields used across community forms. */

export type IntroKind = 'text' | 'file';
export type YesNo = 'yes' | 'no';

export type ContributorDraft = {
  credit: string;
  authorCredit: string;
  introKind: '' | IntroKind;
  introText: string;
  canContact: '' | YesNo;
  /** QQ when contactMode is `qq`; free-form contact otherwise. */
  contact: string;
};

export const CONTRIBUTOR_DEFAULTS: ContributorDraft = {
  credit: '',
  authorCredit: '',
  introKind: '',
  introText: '',
  canContact: '',
  contact: '',
};

export const INTRO_KIND_OPTIONS = [
  { value: 'text', label: '纯文字' },
  { value: 'file', label: '上传文件' },
] as const;

export type ContributorBlockOptions = {
  /** Show original-author credit question. */
  showAuthorCredit: boolean;
  /** Show intro (text / file) question. */
  showIntro: boolean;
  /** `qq` → QQ-only contact; `any` → free-form. */
  contactMode: 'qq' | 'any';
};

export const padQuestionIndex = (n: number) => String(n).padStart(2, '0');

/** How many question slots this block consumes (conditional QQ/contact not counted until visible). */
export const contributorBaseQuestionCount = (
  opts: ContributorBlockOptions,
): number => {
  let n = 1; // credit
  if (opts.showAuthorCredit) n += 1;
  if (opts.showIntro) n += 1;
  n += 1; // canContact
  return n;
};

export const validateContributor = (
  values: ContributorDraft,
  opts: ContributorBlockOptions,
  introFile: File | null,
): string | null => {
  if (opts.showIntro) {
    if (values.introKind === 'file' && !introFile) {
      return '请选择介绍文件，或改选「纯文字」';
    }
  }

  if (values.canContact !== 'yes' && values.canContact !== 'no') {
    return opts.contactMode === 'qq'
      ? '请选择是否可以用 QQ 联系您'
      : '请选择是否可以联系您';
  }
  if (values.canContact === 'yes' && !values.contact.trim()) {
    return opts.contactMode === 'qq'
      ? '选择「是」时请填写 QQ 号'
      : '选择「是」时请留下联系方式';
  }
  return null;
};

export type ContributorPayload = {
  credit: string;
  authorCredit: string;
  introKind: '' | IntroKind;
  introText: string;
  /** Set by submit layer after staging upload when introKind === 'file'. */
  introFile?: { key: string; name: string; size: number };
  canContact: YesNo | '';
  contact: string;
};

export const toContributorPayload = (
  values: ContributorDraft,
  opts: ContributorBlockOptions,
): Omit<ContributorPayload, 'introFile'> => ({
  credit: values.credit.trim(),
  authorCredit: opts.showAuthorCredit ? values.authorCredit.trim() : '',
  introKind: opts.showIntro ? values.introKind : '',
  introText:
    opts.showIntro && values.introKind === 'text'
      ? values.introText.trim()
      : '',
  canContact: values.canContact,
  contact: values.canContact === 'yes' ? values.contact.trim() : '',
});
