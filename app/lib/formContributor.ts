/** Shared contributor / contact draft fields used across community forms. */

import {
  type ContactKind,
  validateContactFields,
} from '~/lib/formContact';

export type IntroKind = 'text' | 'file';
export type YesNo = 'yes' | 'no';

export type ContributorDraft = {
  credit: string;
  authorCredit: string;
  introKind: '' | IntroKind;
  introText: string;
  canContact: '' | YesNo;
  contactKind: '' | ContactKind;
  contact: string;
};

export const CONTRIBUTOR_DEFAULTS: ContributorDraft = {
  credit: '',
  authorCredit: '',
  introKind: '',
  introText: '',
  canContact: '',
  contactKind: '',
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
};

export const padQuestionIndex = (n: number) => String(n).padStart(2, '0');

/** How many question slots this block consumes (conditional contact not counted until visible). */
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
    return '请选择是否可以联系您';
  }
  if (values.canContact === 'yes') {
    return validateContactFields(values.contactKind, values.contact);
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
  contactKind: '' | ContactKind;
  contact: string;
};

export const toContributorPayload = (
  values: ContributorDraft,
  opts: ContributorBlockOptions,
): Omit<ContributorPayload, 'introFile'> => {
  const canContact = values.canContact;
  const allowContact = canContact === 'yes';
  return {
    credit: values.credit.trim(),
    authorCredit: opts.showAuthorCredit ? values.authorCredit.trim() : '',
    introKind: opts.showIntro ? values.introKind : '',
    introText:
      opts.showIntro && values.introKind === 'text'
        ? values.introText.trim()
        : '',
    canContact,
    contactKind: allowContact ? values.contactKind : '',
    contact: allowContact ? values.contact.trim() : '',
  };
};
