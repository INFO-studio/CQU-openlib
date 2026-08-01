import type { ReactNode } from 'react';
import DocLink from '~/components/DocLink';
import { FileInput } from '~/components/ui/file-input';
import { FormChoice, YES_NO_OPTIONS } from '~/components/ui/form-choice';
import { Input } from '~/components/ui/input';
import { InputGroup } from '~/components/ui/input-group';
import { Textarea } from '~/components/ui/textarea';
import {
  CONTACT_KIND_OPTIONS,
  type ContactKind,
  contactInputMode,
  contactPlaceholder,
  validateContactFields,
} from '~/lib/formContact';
import {
  type ContributorBlockOptions,
  type ContributorDraft,
  INTRO_KIND_OPTIONS,
} from '~/lib/formContributor';
import { type FormItemInput, question } from '~/lib/formItems';
import { requireFile } from '~/lib/formSubmit';

type Args = {
  values: ContributorDraft;
  /** Patch form so one interaction can reset several fields at once. */
  onChange: (patch: Partial<ContributorDraft>) => void;
  introFile: File | null;
  onIntroFileChange: (file: File | null) => void;
  options: ContributorBlockOptions;
};

const contributorLinkClass =
  'mx-0.5 text-primary underline-offset-2 hover:underline';

const CreditLabel = (): ReactNode => (
  <>
    您可以对您的贡献署名，我们会将其插入
    <DocLink path="/contributor" className={contributorLinkClass}>
      「贡献者」
    </DocLink>
    栏，那么您希望的署名是
  </>
);

const IntroLabel = (): ReactNode => (
  <>
    您也可以同
    <DocLink path="/contributor" className={contributorLinkClass}>
      「贡献者」
    </DocLink>
    栏的其他人一样，写一篇自己的介绍
  </>
);

const AUTHOR_CREDIT_LABEL =
  '该文件原作者同样可以对该贡献署名，若您并非文件原作者，文件为非出版物，且能与原作者取得联系，原作者希望的署名是';

const CAN_CONTACT_LABEL = '我可以联系您来获取进一步信息吗';
const CONTACT_LABEL = '您的联系方式是';

/**
 * Shared trailing block: credit → optional author → optional intro →
 * canContact → contact. Appended to a form's own items.
 */
export const contributorItems = ({
  values,
  onChange,
  introFile,
  onIntroFileChange,
  options,
}: Args): FormItemInput[] => [
  question({
    key: 'credit',
    label: <CreditLabel />,
    hint: '署名可以是任何名称，此问题空白则为匿名上传。',
    children: (
      <Input
        value={values.credit}
        onChange={(ev) => onChange({ credit: ev.target.value })}
        placeholder="留空则为匿名"
        autoComplete="nickname"
      />
    ),
  }),

  options.showAuthorCredit &&
    question({
      key: 'authorCredit',
      label: AUTHOR_CREDIT_LABEL,
      hint: '不满足上述要求时，您可忽略该问题。署名可以是任何名称，此问题空白则为匿名上传。',
      children: (
        <Input
          value={values.authorCredit}
          onChange={(ev) => onChange({ authorCredit: ev.target.value })}
          placeholder="可留空"
          autoComplete="off"
        />
      ),
    }),

  options.showIntro &&
    question({
      key: 'intro',
      label: <IntroLabel />,
      hint: '我们会为您调整格式，请勿担心。介绍可选；若选择上传文件，将在提交时一并上传。',
      validate: () =>
        values.introKind === 'file'
          ? requireFile(introFile, '请选择介绍文件，或改选「纯文字」')()
          : null,
      children: (
        <>
          <FormChoice
            value={values.introKind}
            options={INTRO_KIND_OPTIONS}
            columns={2}
            onChange={(v) => {
              onChange({
                introKind: v,
                ...(v !== 'text' ? { introText: '' } : {}),
              });
              if (v !== 'file') onIntroFileChange(null);
            }}
            aria-label="介绍方式"
          />
          {values.introKind === 'text' ? (
            <Textarea
              className="mt-3"
              value={values.introText}
              onChange={(ev) => onChange({ introText: ev.target.value })}
              placeholder="在此写下介绍正文，可留空"
            />
          ) : null}
          {values.introKind === 'file' ? (
            <FileInput
              className="mt-3"
              file={introFile}
              onChange={onIntroFileChange}
              hint="支持 PDF / 图片 / Markdown 等"
            />
          ) : null}
        </>
      ),
    }),

  question({
    key: 'canContact',
    label: CAN_CONTACT_LABEL,
    required: true,
    validate: () =>
      values.canContact === 'yes' || values.canContact === 'no'
        ? null
        : '请选择是否可以联系您',
    children: (
      <FormChoice
        value={values.canContact}
        options={YES_NO_OPTIONS}
        onChange={(v) =>
          onChange(
            v === 'yes'
              ? { canContact: v }
              : { canContact: v, contactKind: '', contact: '' },
          )
        }
        aria-label={CAN_CONTACT_LABEL}
      />
    ),
  }),

  values.canContact === 'yes' &&
    question({
      key: 'contact',
      label: CONTACT_LABEL,
      required: true,
      validate: () => validateContactFields(values.contactKind, values.contact),
      children: (
        <InputGroup
          options={CONTACT_KIND_OPTIONS}
          selectValue={values.contactKind}
          onSelectChange={(v) => onChange({ contactKind: v as ContactKind })}
          selectLabel="联系渠道"
          inputProps={{
            value: values.contact,
            onChange: (ev) => onChange({ contact: ev.target.value }),
            placeholder: contactPlaceholder(values.contactKind),
            inputMode: contactInputMode(values.contactKind),
            autoComplete: 'off',
          }}
        />
      ),
    }),
];
