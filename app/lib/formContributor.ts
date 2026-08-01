/** Shared contributor / contact draft fields used across community forms. */

import type { ContactKind } from '~/lib/formContact';

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
