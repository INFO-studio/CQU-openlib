import { Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ContributorFields } from '~/components/forms/ContributorFields';
import { FormDone } from '~/components/forms/FormDone';
import { FormError } from '~/components/forms/FormError';
import { FormQuestion } from '~/components/forms/FormQuestion';
import { FormShell } from '~/components/forms/FormShell';
import { FormStack } from '~/components/forms/FormStack';
import { SubmitProgressOverlay } from '~/components/forms/SubmitProgressOverlay';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { useFormDraft } from '~/hooks/useFormDraft';
import {
  type ContributorDraft,
  CONTRIBUTOR_DEFAULTS,
  toContributorPayload,
  validateContributor,
} from '~/lib/formContributor';
import {
  type UploadProgress,
  IDLE_UPLOAD_PROGRESS,
  submitFormWithFiles,
} from '~/lib/formSubmit';

type Props = {
  initialPage?: string;
};

type FeedbackDraft = {
  page: string;
  content: string;
} & ContributorDraft;

const DEFAULTS: FeedbackDraft = {
  page: '',
  content: '',
  ...CONTRIBUTOR_DEFAULTS,
};

const TITLE = '页面反馈表单';
const LEDE = '我们会认真聆听并对您的反馈作出适当的变化。';

const FEEDBACK_CONTRIBUTOR_OPTS = {
  showAuthorCredit: false,
  showIntro: false,
};

const IDLE_PROGRESS = IDLE_UPLOAD_PROGRESS;

export const FeedbackForm = ({ initialPage = '' }: Props) => {
  const { values, setField, clear } = useFormDraft({
    slug: 'feedback',
    defaults: DEFAULTS,
    seed: initialPage ? { page: initialPage } : undefined,
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>(IDLE_PROGRESS);

  const setContributorField = <K extends keyof ContributorDraft>(
    key: K,
    value: ContributorDraft[K],
  ) => {
    setField(
      key as keyof FeedbackDraft,
      value as FeedbackDraft[keyof FeedbackDraft],
    );
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!values.page.trim()) {
      setError('请填写有问题的页面');
      return;
    }
    if (!values.content.trim()) {
      setError('请说明具体问题');
      return;
    }

    const contributorError = validateContributor(
      values,
      FEEDBACK_CONTRIBUTOR_OPTS,
      null,
    );
    if (contributorError) {
      setError(contributorError);
      return;
    }

    setSubmitting(true);
    setProgress(IDLE_UPLOAD_PROGRESS);

    try {
      const contributor = toContributorPayload(
        values,
        FEEDBACK_CONTRIBUTOR_OPTS,
      );
      await submitFormWithFiles({
        type: 'feedback',
        files: [],
        onProgress: setProgress,
        buildPayload: () => ({
          content: values.content.trim(),
          page: values.page.trim(),
          credit: contributor.credit,
          canContact: contributor.canContact,
          contactKind: contributor.contactKind,
          contact: contributor.contact,
        }),
      });
      clear();
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
        <FormQuestion index="01" label="您认为有问题的页面是" required>
          <Input
            name="page"
            value={values.page}
            onChange={(ev) => setField('page', ev.target.value)}
            placeholder="/course/高等数学 或完整链接"
            autoComplete="off"
            required
          />
        </FormQuestion>

        <FormQuestion
          index="02"
          label="能否说明有什么问题"
          required
          hint={
            <>
              如遇教材等书籍改版或缺失等问题，请填写
              <Link
                to="/form/$type"
                params={{ type: 'textbook' }}
                className="mx-0.5 text-primary underline-offset-2 hover:underline"
              >
                教材收集表
              </Link>
              。
            </>
          }
        >
          <Textarea
            name="content"
            value={values.content}
            onChange={(ev) => setField('content', ev.target.value)}
            placeholder="哪里错了、缺什么、链接失效……"
            required
          />
        </FormQuestion>

        <ContributorFields
          startIndex={3}
          values={values}
          setField={setContributorField}
          introFile={null}
          onIntroFileChange={() => {}}
          options={FEEDBACK_CONTRIBUTOR_OPTS}
        />

        {error ? <FormError>{error}</FormError> : null}

        <div className="pt-2">
          <Button type="submit" variant="primary" disabled={submitting}>
            提交
          </Button>
          <p className="mt-2 text-xs text-muted">
            未提交的内容会自动保存在本机，下次打开可继续填写。
          </p>
        </div>
      </FormStack>
    </FormShell>
  );
};
