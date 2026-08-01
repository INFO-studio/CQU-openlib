import { Link } from '@tanstack/react-router';
import { type FormEvent, useCallback } from 'react';
import { contributorItems } from '~/components/forms/contributorItems';
import { FormPage } from '~/components/forms/FormPage';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { useFormDraft } from '~/hooks/useFormDraft';
import { useFormSubmit } from '~/hooks/useFormSubmit';
import {
  CONTRIBUTOR_DEFAULTS,
  type ContributorDraft,
  toContributorPayload,
} from '~/lib/formContributor';
import { type FormItemInput, question, requireText } from '~/lib/formItems';

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

const CONTRIBUTOR_OPTS = {
  showAuthorCredit: false,
  showIntro: false,
};

export const FeedbackForm = ({ initialPage = '' }: Props) => {
  const { values, setField, setValues, clear } = useFormDraft({
    slug: 'feedback',
    defaults: DEFAULTS,
    seed: initialPage ? { page: initialPage } : undefined,
  });
  const form = useFormSubmit('feedback');

  const setContributor = useCallback(
    (patch: Partial<ContributorDraft>) =>
      setValues((prev) => ({ ...prev, ...patch })),
    [setValues],
  );

  const items: FormItemInput[] = [
    question({
      key: 'page',
      label: '您认为有问题的页面是',
      required: true,
      validate: requireText(values.page, '请填写有问题的页面'),
      children: (
        <Input
          name="page"
          value={values.page}
          onChange={(ev) => setField('page', ev.target.value)}
          placeholder="/course/高等数学 或完整链接"
          autoComplete="off"
        />
      ),
    }),

    question({
      key: 'content',
      label: '能否说明有什么问题',
      required: true,
      hint: (
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
      ),
      validate: requireText(values.content, '请说明具体问题'),
      children: (
        <Textarea
          name="content"
          value={values.content}
          onChange={(ev) => setField('content', ev.target.value)}
          placeholder="哪里错了、缺什么、链接失效……"
        />
      ),
    }),

    ...contributorItems({
      values,
      onChange: setContributor,
      introFile: null,
      onIntroFileChange: () => {},
      options: CONTRIBUTOR_OPTS,
    }),
  ];

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void form.submit({
      items,
      buildPayload: () => {
        const contributor = toContributorPayload(values, CONTRIBUTOR_OPTS);
        return {
          content: values.content.trim(),
          page: values.page.trim(),
          credit: contributor.credit,
          canContact: contributor.canContact,
          contactKind: contributor.contactKind,
          contact: contributor.contact,
        };
      },
      onSuccess: clear,
    });
  };

  return (
    <FormPage
      slug="feedback"
      items={items}
      alert={form.alert}
      showErrors={form.showErrors}
      done={form.done}
      submitting={form.submitting}
      progress={form.progress}
      onSubmit={onSubmit}
      onAgain={form.writeAgain}
    />
  );
};
