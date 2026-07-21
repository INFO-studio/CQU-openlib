import { type FormEvent, useMemo, useState } from 'react';
import { ContributorFields } from '~/components/forms/ContributorFields';
import { FormDone } from '~/components/forms/FormDone';
import { FormError } from '~/components/forms/FormError';
import { FormQuestion } from '~/components/forms/FormQuestion';
import { FormShell } from '~/components/forms/FormShell';
import { FormStack } from '~/components/forms/FormStack';
import { SubmitProgressOverlay } from '~/components/forms/SubmitProgressOverlay';
import { Button } from '~/components/ui/button';
import { FileInput } from '~/components/ui/file-input';
import { FormChoice } from '~/components/ui/form-choice';
import { Input } from '~/components/ui/input';
import { useFormDraft } from '~/hooks/useFormDraft';
import {
  type ContributorBlockOptions,
  type ContributorDraft,
  CONTRIBUTOR_DEFAULTS,
  padQuestionIndex,
  toContributorPayload,
  validateContributor,
} from '~/lib/formContributor';
import {
  type StagingFileRef,
  type UploadProgress,
  IDLE_UPLOAD_PROGRESS,
  submitFormWithFiles,
} from '~/lib/formSubmit';

const TITLE = '文件上传';
const LEDE =
  '贡献教材、试卷、课件、笔记或其他课程相关文件。选择文件后，将在提交时上传。';

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

const IDLE_PROGRESS = IDLE_UPLOAD_PROGRESS;

const contributorOptionsFor = (
  category: Category,
): ContributorBlockOptions => {
  if (category === 'slides') {
    return {
      showAuthorCredit: false,
      showIntro: false,
    };
  }
  if (category === 'textbook') {
    return {
      showAuthorCredit: false,
      showIntro: true,
    };
  }
  // exam / notes / other
  return {
    showAuthorCredit: true,
    showIntro: true,
  };
};

export const UploadForm = () => {
  const { values, setField, clear } = useFormDraft({
    slug: 'upload',
    defaults: DEFAULTS,
  });
  const [file, setFile] = useState<File | null>(null);
  const [introFile, setIntroFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>(IDLE_PROGRESS);

  const category = values.category;
  const contributorOpts = category
    ? contributorOptionsFor(category)
    : null;

  const setContributorField = <K extends keyof ContributorDraft>(
    key: K,
    value: ContributorDraft[K],
  ) => {
    setField(key as keyof UploadDraft, value as UploadDraft[keyof UploadDraft]);
  };

  /** Question index where contributor block starts (after category-specific fields). */
  const contributorStartIndex = useMemo(() => {
    if (!category) return 2;
    let n = 2;
    if (category === 'exam') n += 1;
    if (category === 'other') n += 1;
    n += 1; // courseCode
    if (category === 'slides') n += 1;
    if (category === 'notes') n += 1;
    n += 1; // file
    return n;
  }, [category]);

  const indices = useMemo(() => {
    if (!category) return {} as Record<string, string>;
    let n = 2;
    const next = () => padQuestionIndex(n++);
    const map: Record<string, string> = {};
    if (category === 'exam') map.examKind = next();
    if (category === 'other') map.purpose = next();
    map.courseCode = next();
    if (category === 'slides') map.confirmAuthorized = next();
    if (category === 'notes') map.confirmNoPii = next();
    map.file = next();
    return map;
  }, [category]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!category || !contributorOpts) {
      setError('请选择要贡献的项目');
      return;
    }
    if (category === 'exam' && !values.examKind) {
      setError('请选择试卷种类');
      return;
    }
    if (
      category === 'exam' &&
      values.examKind === '其他' &&
      !values.examKindOther.trim()
    ) {
      setError('请填写试卷种类');
      return;
    }
    if (category === 'other' && !values.purpose.trim()) {
      setError('请填写该文件的用途');
      return;
    }
    if (!values.courseCode.trim()) {
      setError('请填写课程号');
      return;
    }
    if (category === 'slides' && values.confirmAuthorized !== 'yes') {
      setError('请确认课件已获授权且不含机密信息');
      return;
    }
    if (category === 'notes' && values.confirmNoPii !== 'yes') {
      setError('请确认笔记不含敏感个人信息');
      return;
    }
    if (!file) {
      setError('请选择要上传的文件');
      return;
    }

    const contributorError = validateContributor(
      values,
      contributorOpts,
      introFile,
    );
    if (contributorError) {
      setError(contributorError);
      return;
    }

    const uploadFiles: File[] = [file];
    const includeIntroFile =
      contributorOpts.showIntro &&
      values.introKind === 'file' &&
      introFile;
    if (includeIntroFile && introFile) uploadFiles.push(introFile);

    setSubmitting(true);
    setProgress({
      phase: 'upload',
      fileIndex: 1,
      fileTotal: uploadFiles.length,
    });

    try {
      await submitFormWithFiles({
        type: 'upload',
        files: uploadFiles,
        onProgress: setProgress,
        buildPayload: (uploaded) => {
          const main = uploaded[0] as StagingFileRef;
          const introRef =
            includeIntroFile && uploaded[1] ? uploaded[1] : undefined;
          const contributor = toContributorPayload(values, contributorOpts);
          return {
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
            file: main,
            ...contributor,
            introFile: introRef,
            page: '',
          };
        },
      });
      clear();
      setFile(null);
      setIntroFile(null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
      setProgress(IDLE_PROGRESS);
    }
  };

  if (done) {
    return (
      <FormDone title={TITLE} lede={LEDE} onAgain={() => setDone(false)} />
    );
  }

  return (
    <FormShell title={TITLE} lede={LEDE}>
      <SubmitProgressOverlay open={submitting} progress={progress} />
      <FormStack onSubmit={onSubmit}>
        <FormQuestion index="01" label="您要贡献的项目" required>
          <FormChoice
            value={values.category}
            options={CATEGORY_OPTIONS}
            columns={3}
            onChange={(v) => {
              setField('category', v);
              setField('examKind', '');
              setField('examKindOther', '');
              setField('purpose', '');
              setField('confirmAuthorized', '');
              setField('confirmNoPii', '');
              setField('authorCredit', '');
              setField('introKind', '');
              setField('introText', '');
              setIntroFile(null);
            }}
            aria-label="贡献项目"
          />
        </FormQuestion>

        {category === 'exam' && indices.examKind ? (
          <FormQuestion index={indices.examKind} label="试卷种类" required>
            <FormChoice
              value={values.examKind}
              options={EXAM_KIND_OPTIONS}
              columns={1}
              onChange={(v) => {
                setField('examKind', v);
                if (v !== '其他') setField('examKindOther', '');
              }}
              other={{
                value: '其他',
                text: values.examKindOther,
                onTextChange: (text) => setField('examKindOther', text),
                placeholder: '请注明试卷种类',
              }}
              aria-label="试卷种类"
            />
          </FormQuestion>
        ) : null}

        {category === 'other' && indices.purpose ? (
          <FormQuestion index={indices.purpose} label="该文件的用途" required>
            <Input
              value={values.purpose}
              onChange={(ev) => setField('purpose', ev.target.value)}
              placeholder="简要说明用途"
            />
          </FormQuestion>
        ) : null}

        {category && indices.courseCode ? (
          <FormQuestion
            index={indices.courseCode}
            label={
              category === 'textbook'
                ? '教材所匹配的课程号'
                : category === 'exam'
                  ? '试卷所匹配的课程号'
                  : category === 'slides'
                    ? '课件所匹配的课程号'
                    : category === 'notes'
                      ? '笔记所匹配的课程号'
                      : '该文件所匹配的课程号'
            }
            required
            hint="如：MATH10821"
          >
            <Input
              value={values.courseCode}
              onChange={(ev) => setField('courseCode', ev.target.value)}
              placeholder="MATH10821"
              autoComplete="off"
            />
          </FormQuestion>
        ) : null}

        {category === 'slides' && indices.confirmAuthorized ? (
          <FormQuestion
            index={indices.confirmAuthorized}
            label="若某老师持有该课件的知识产权，请务必确认其已经授权本站使用，课件内不得含有任何机密信息"
            required
          >
            <FormChoice
              value={values.confirmAuthorized}
              options={CONFIRM_OPTIONS}
              columns={1}
              onChange={(v) => setField('confirmAuthorized', v)}
              aria-label="确认课件授权"
            />
          </FormQuestion>
        ) : null}

        {category === 'notes' && indices.confirmNoPii ? (
          <FormQuestion
            index={indices.confirmNoPii}
            label="请确认您的笔记没有包含任何敏感个人信息"
            required
            hint="真实姓名 / 学号 / 行政班等"
          >
            <FormChoice
              value={values.confirmNoPii}
              options={CONFIRM_OPTIONS}
              columns={1}
              onChange={(v) => setField('confirmNoPii', v)}
              aria-label="确认无敏感信息"
            />
          </FormQuestion>
        ) : null}

        {category && indices.file ? (
          <FormQuestion
            index={indices.file}
            label="选择要上传的文件"
            required
            hint="提交时才会开始上传；单文件不超过 50MB。"
          >
            <FileInput file={file} onChange={setFile} />
          </FormQuestion>
        ) : null}

        {category && contributorOpts ? (
          <ContributorFields
            startIndex={contributorStartIndex}
            values={values}
            setField={setContributorField}
            introFile={introFile}
            onIntroFileChange={setIntroFile}
            options={contributorOpts}
          />
        ) : null}

        {error ? <FormError>{error}</FormError> : null}

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !category}
          >
            提交
          </Button>
          <p className="mt-2 text-xs text-muted">
            未提交的文字会自动保存在本机；文件仅在点击提交后串行上传。
          </p>
        </div>
      </FormStack>
    </FormShell>
  );
};
