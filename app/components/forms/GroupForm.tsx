import { type FormEvent, useState } from 'react';
import { FormDone } from '~/components/forms/FormDone';
import { FormError } from '~/components/forms/FormError';
import { FormQuestion } from '~/components/forms/FormQuestion';
import { FormShell } from '~/components/forms/FormShell';
import { FormStack } from '~/components/forms/FormStack';
import { SubmitProgressOverlay } from '~/components/forms/SubmitProgressOverlay';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { InputGroup } from '~/components/ui/input-group';
import { Textarea } from '~/components/ui/textarea';
import { useFormDraft } from '~/hooks/useFormDraft';
import {
  CONTACT_KIND_OPTIONS,
  type ContactKind,
  contactInputMode,
  contactPlaceholder,
  validateContactFields,
} from '~/lib/formContact';
import {
  IDLE_UPLOAD_PROGRESS,
  submitFormWithFiles,
  type UploadProgress,
} from '~/lib/formSubmit';

const TITLE = '学生团体收录表';
const LEDE =
  '非官方学生团体申请收录。请填写简介、QQ 群号与联系方式，我们会审核后更新页面。';

type GroupDraft = {
  name: string;
  intro: string;
  qqGroup: string;
  contactKind: '' | ContactKind;
  contact: string;
};

const DEFAULTS: GroupDraft = {
  name: '',
  intro: '',
  qqGroup: '',
  contactKind: '',
  contact: '',
};

const IDLE_PROGRESS = IDLE_UPLOAD_PROGRESS;

export const GroupForm = () => {
  const { values, setField, clear } = useFormDraft({
    slug: 'group',
    defaults: DEFAULTS,
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>(IDLE_PROGRESS);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!values.name.trim()) {
      setError('请填写团体名称');
      return;
    }
    if (!values.intro.trim()) {
      setError('请填写简介');
      return;
    }
    if (!values.qqGroup.trim()) {
      setError('请填写 QQ 群号');
      return;
    }

    const contactError = validateContactFields(
      values.contactKind,
      values.contact,
    );
    if (contactError) {
      setError(contactError);
      return;
    }

    setSubmitting(true);
    setProgress(IDLE_UPLOAD_PROGRESS);

    try {
      await submitFormWithFiles({
        type: 'group',
        files: [],
        onProgress: setProgress,
        buildPayload: () => ({
          name: values.name.trim(),
          intro: values.intro.trim(),
          qqGroup: values.qqGroup.trim(),
          contactKind: values.contactKind,
          contact: values.contact.trim(),
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
        <FormQuestion index="01" label="团体名称" required>
          <Input
            value={values.name}
            onChange={(ev) => setField('name', ev.target.value)}
            placeholder="对外常用名称"
            autoComplete="off"
          />
        </FormQuestion>

        <FormQuestion index="02" label="简介" required>
          <Textarea
            value={values.intro}
            onChange={(ev) => setField('intro', ev.target.value)}
            placeholder="团体主题、活动或定位"
          />
        </FormQuestion>

        <FormQuestion index="03" label="QQ 群号" required>
          <Input
            value={values.qqGroup}
            onChange={(ev) => setField('qqGroup', ev.target.value)}
            placeholder="公开纳新或常驻群号"
            inputMode="numeric"
            autoComplete="off"
          />
        </FormQuestion>

        <FormQuestion
          index="04"
          label="您的联系方式是"
          required
          hint="以便审核时沟通。"
        >
          <InputGroup
            options={CONTACT_KIND_OPTIONS}
            selectValue={values.contactKind}
            onSelectChange={(v) => setField('contactKind', v)}
            selectLabel="联系渠道"
            inputProps={{
              value: values.contact,
              onChange: (ev) => setField('contact', ev.target.value),
              placeholder: contactPlaceholder(values.contactKind),
              inputMode: contactInputMode(values.contactKind),
              autoComplete: 'off',
            }}
          />
        </FormQuestion>

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
