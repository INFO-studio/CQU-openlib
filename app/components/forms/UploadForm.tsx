import { type FormEvent, useCallback, useState } from 'react';
import { contributorItems } from '~/components/forms/contributorItems';
import { DRAFT_NOTE_WITH_FILES, FormPage } from '~/components/forms/FormPage';
import { FileInput } from '~/components/ui/file-input';
import { FormChoice } from '~/components/ui/form-choice';
import { Input } from '~/components/ui/input';
import { useFormDraft } from '~/hooks/useFormDraft';
import { useFormSubmit } from '~/hooks/useFormSubmit';
import {
  CONTRIBUTOR_DEFAULTS,
  type ContributorBlockOptions,
  type ContributorDraft,
  toContributorPayload,
} from '~/lib/formContributor';
import {
  type FormItemInput,
  question,
  requireChoice,
  requireText,
} from '~/lib/formItems';
import {
  requireFile,
  type StagingFileRef,
  UPLOAD_HINT,
} from '~/lib/formSubmit';

const CATEGORY_OPTIONS = [
  { value: 'textbook', label: '教材' },
  { value: 'exam', label: '试卷' },
  { value: 'slides', label: '课件' },
  { value: 'notes', label: '笔记' },
  { value: 'other', label: '其他' },
] as const;

const EXAM_KIND_OPTIONS = [
  { value: '期中试卷', label: '期中试卷' },
  { value: '期末试卷', label: '期末试卷' },
  { value: '其他', label: '其他' },
] as const;

const CONFIRM_OPTIONS = [{ value: 'yes', label: '我确认' }] as const;

type Category = (typeof CATEGORY_OPTIONS)[number]['value'];
type ExamKind = (typeof EXAM_KIND_OPTIONS)[number]['value'];

type UploadDraft = {
  category: '' | Category;
  courseCode: string;
  examKind: '' | ExamKind;
  examKindOther: string;
  purpose: string;
  confirmAuthorized: '' | 'yes';
  confirmNoPii: '' | 'yes';
} & ContributorDraft;

const DEFAULTS: UploadDraft = {
  category: '',
  courseCode: '',
  examKind: '',
  examKindOther: '',
  purpose: '',
  confirmAuthorized: '',
  confirmNoPii: '',
  ...CONTRIBUTOR_DEFAULTS,
};

const COURSE_CODE_LABEL: Record<Category, string> = {
  textbook: '教材所匹配的课程号',
  exam: '试卷所匹配的课程号',
  slides: '课件所匹配的课程号',
  notes: '笔记所匹配的课程号',
  other: '该文件所匹配的课程号',
};

const CONTRIBUTOR_OPTS: Record<Category, ContributorBlockOptions> = {
  slides: { showAuthorCredit: false, showIntro: false },
  textbook: { showAuthorCredit: false, showIntro: true },
  exam: { showAuthorCredit: true, showIntro: true },
  notes: { showAuthorCredit: true, showIntro: true },
  other: { showAuthorCredit: true, showIntro: true },
};

export const UploadForm = () => {
  const { values, setField, setValues, clear } = useFormDraft({
    slug: 'upload',
    defaults: DEFAULTS,
  });
  const form = useFormSubmit('upload');
  const [file, setFile] = useState<File | null>(null);
  const [introFile, setIntroFile] = useState<File | null>(null);

  const category = values.category;
  const contributorOpts = category ? CONTRIBUTOR_OPTS[category] : null;

  const setContributor = useCallback(
    (patch: Partial<ContributorDraft>) =>
      setValues((prev) => ({ ...prev, ...patch })),
    [setValues],
  );

  const items: FormItemInput[] = [
    question({
      key: 'category',
      label: '您要贡献的项目',
      required: true,
      validate: requireChoice(values.category, '请选择要贡献的项目'),
      children: (
        <FormChoice
          value={values.category}
          options={CATEGORY_OPTIONS}
          columns={3}
          onChange={(v) => {
            setValues((prev) => ({
              ...prev,
              category: v,
              examKind: '',
              examKindOther: '',
              purpose: '',
              confirmAuthorized: '',
              confirmNoPii: '',
              authorCredit: '',
              introKind: '',
              introText: '',
            }));
            setIntroFile(null);
          }}
          aria-label="贡献项目"
        />
      ),
    }),

    category === 'exam' &&
      question({
        key: 'examKind',
        label: '试卷种类',
        required: true,
        validate: () => {
          if (!values.examKind) return '请选择试卷种类';
          if (values.examKind === '其他' && !values.examKindOther.trim()) {
            return '请填写试卷种类';
          }
          return null;
        },
        children: (
          <FormChoice
            value={values.examKind}
            options={EXAM_KIND_OPTIONS}
            columns={1}
            onChange={(v) =>
              setValues((prev) => ({
                ...prev,
                examKind: v,
                ...(v !== '其他' ? { examKindOther: '' } : {}),
              }))
            }
            other={{
              value: '其他',
              text: values.examKindOther,
              onTextChange: (text) => setField('examKindOther', text),
              placeholder: '请注明试卷种类',
            }}
            aria-label="试卷种类"
          />
        ),
      }),

    category === 'other' &&
      question({
        key: 'purpose',
        label: '该文件的用途',
        required: true,
        validate: requireText(values.purpose, '请填写该文件的用途'),
        children: (
          <Input
            value={values.purpose}
            onChange={(ev) => setField('purpose', ev.target.value)}
            placeholder="简要说明用途"
          />
        ),
      }),

    !!category &&
      question({
        key: 'courseCode',
        label: COURSE_CODE_LABEL[category],
        required: true,
        hint: '如：MATH10821',
        validate: requireText(values.courseCode, '请填写课程号'),
        children: (
          <Input
            value={values.courseCode}
            onChange={(ev) => setField('courseCode', ev.target.value)}
            placeholder="MATH10821"
            autoComplete="off"
          />
        ),
      }),

    category === 'slides' &&
      question({
        key: 'confirmAuthorized',
        label:
          '若某老师持有该课件的知识产权，请务必确认其已经授权本站使用，课件内不得含有任何机密信息',
        required: true,
        validate: () =>
          values.confirmAuthorized === 'yes'
            ? null
            : '请确认课件已获授权且不含机密信息',
        children: (
          <FormChoice
            value={values.confirmAuthorized}
            options={CONFIRM_OPTIONS}
            columns={1}
            onChange={(v) => setField('confirmAuthorized', v)}
            aria-label="确认课件授权"
          />
        ),
      }),

    category === 'notes' &&
      question({
        key: 'confirmNoPii',
        label: '请确认您的笔记没有包含任何敏感个人信息',
        required: true,
        hint: '真实姓名 / 学号 / 行政班等',
        validate: () =>
          values.confirmNoPii === 'yes' ? null : '请确认笔记不含敏感个人信息',
        children: (
          <FormChoice
            value={values.confirmNoPii}
            options={CONFIRM_OPTIONS}
            columns={1}
            onChange={(v) => setField('confirmNoPii', v)}
            aria-label="确认无敏感信息"
          />
        ),
      }),

    !!category &&
      question({
        key: 'file',
        label: '选择要上传的文件',
        required: true,
        hint: UPLOAD_HINT,
        validate: requireFile(file, '请选择要上传的文件'),
        children: <FileInput file={file} onChange={setFile} />,
      }),

    ...(contributorOpts
      ? contributorItems({
          values,
          onChange: setContributor,
          introFile,
          onIntroFileChange: setIntroFile,
          options: contributorOpts,
        })
      : []),
  ];

  const withIntroFile = Boolean(
    contributorOpts?.showIntro && values.introKind === 'file' && introFile,
  );
  const uploadFiles: File[] = file
    ? withIntroFile && introFile
      ? [file, introFile]
      : [file]
    : [];

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!category || !contributorOpts) return;
    void form.submit({
      items,
      files: uploadFiles,
      buildPayload: (uploaded) => ({
        category,
        courseCode: values.courseCode.trim(),
        examKind: category === 'exam' ? values.examKind : '',
        examKindOther:
          category === 'exam' && values.examKind === '其他'
            ? values.examKindOther.trim()
            : '',
        purpose: category === 'other' ? values.purpose.trim() : '',
        confirmAuthorized:
          category === 'slides' ? values.confirmAuthorized : '',
        confirmNoPii: category === 'notes' ? values.confirmNoPii : '',
        file: uploaded[0] as StagingFileRef,
        ...toContributorPayload(values, contributorOpts),
        introFile: withIntroFile ? uploaded[1] : undefined,
        page: '',
      }),
      onSuccess: () => {
        clear();
        setFile(null);
        setIntroFile(null);
      },
    });
  };

  return (
    <FormPage
      slug="upload"
      items={items}
      alert={form.alert}
      showErrors={form.showErrors}
      done={form.done}
      submitting={form.submitting}
      progress={form.progress}
      onSubmit={onSubmit}
      onAgain={form.writeAgain}
      submitDisabled={!category}
      footnote={DRAFT_NOTE_WITH_FILES}
    />
  );
};
