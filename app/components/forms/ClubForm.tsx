import { type FormEvent, useState } from 'react';
import { FormDone } from '~/components/forms/FormDone';
import { FormError } from '~/components/forms/FormError';
import { FormQuestion } from '~/components/forms/FormQuestion';
import { FormShell } from '~/components/forms/FormShell';
import { FormStack } from '~/components/forms/FormStack';
import { SubmitProgressOverlay } from '~/components/forms/SubmitProgressOverlay';
import { Button } from '~/components/ui/button';
import { FormChoice } from '~/components/ui/form-choice';
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

const TITLE = '社团信息表单';
const LEDE = '社长或管理人员提交社团信息更正与补充。';

const AFFILIATION_OPTIONS = [
  { value: '学生社团中心', label: '学生社团中心' },
  { value: '直属社团', label: '直属社团' },
  { value: '青年志愿者协会', label: '青年志愿者协会' },
  { value: '科学技术协会', label: '科学技术协会' },
  { value: '文联', label: '文联' },
  { value: '体育协会', label: '体育协会' },
  { value: '职业发展协会', label: '职业发展协会' },
] as const;

const UPDATE_KIND_OPTIONS = [
  { value: 'change', label: '社团变动' },
  { value: 'recruit', label: '纳新群号' },
  { value: 'intro', label: '社团简介' },
] as const;

const CHANGE_TYPE_OPTIONS = [
  { value: 'join', label: '新社团加入' },
  { value: 'rename', label: '社团更名' },
  { value: 'dissolve', label: '社团解散' },
] as const;

type Affiliation = (typeof AFFILIATION_OPTIONS)[number]['value'];
type UpdateKind = (typeof UPDATE_KIND_OPTIONS)[number]['value'];
type ChangeType = (typeof CHANGE_TYPE_OPTIONS)[number]['value'];

type ClubDraft = {
  name: string;
  affiliation: '' | Affiliation;
  updateKind: '' | UpdateKind;
  changeType: '' | ChangeType;
  formerName: string;
  recruitGroup: string;
  intro: string;
  contactKind: '' | ContactKind;
  contact: string;
};

const DEFAULTS: ClubDraft = {
  name: '',
  affiliation: '',
  updateKind: '',
  changeType: '',
  formerName: '',
  recruitGroup: '',
  intro: '',
  contactKind: '',
  contact: '',
};

const IDLE_PROGRESS = IDLE_UPLOAD_PROGRESS;

export const ClubForm = () => {
  const { values, setField, clear } = useFormDraft({
    slug: 'club',
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
      setError('请填写社团名');
      return;
    }
    if (!values.affiliation) {
      setError('请选择社团所属');
      return;
    }
    if (!values.updateKind) {
      setError('请选择要更新的信息');
      return;
    }

    if (values.updateKind === 'change') {
      if (!values.changeType) {
        setError('请选择变动类型');
        return;
      }
      if (values.changeType === 'rename' && !values.formerName.trim()) {
        setError('请填写原社团名称');
        return;
      }
    }

    if (values.updateKind === 'recruit' && !values.recruitGroup.trim()) {
      setError('请填写纳新群号');
      return;
    }

    if (values.updateKind === 'intro' && !values.intro.trim()) {
      setError('请填写简介内容');
      return;
    }

    // 纳新群号只需群号；联系方式可选
    if (values.updateKind !== 'recruit') {
      const contactError = validateContactFields(
        values.contactKind,
        values.contact,
      );
      if (contactError) {
        setError(contactError);
        return;
      }
    }

    setSubmitting(true);
    setProgress(IDLE_UPLOAD_PROGRESS);

    try {
      await submitFormWithFiles({
        type: 'club',
        files: [],
        onProgress: setProgress,
        buildPayload: () => ({
          name: values.name.trim(),
          affiliation: values.affiliation,
          updateKind: values.updateKind,
          changeType: values.updateKind === 'change' ? values.changeType : '',
          formerName:
            values.updateKind === 'change' && values.changeType === 'rename'
              ? values.formerName.trim()
              : '',
          recruitGroup:
            values.updateKind === 'recruit' ? values.recruitGroup.trim() : '',
          intro: values.updateKind === 'intro' ? values.intro.trim() : '',
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

  const kind = values.updateKind;

  const iChangeType = kind === 'change' ? '04' : null;
  const iFormer =
    kind === 'change' && values.changeType === 'rename' ? '05' : null;
  const iRecruit = kind === 'recruit' ? '04' : null;
  const iIntro = kind === 'intro' ? '04' : null;
  const iContact = (() => {
    if (kind === 'change') {
      return values.changeType === 'rename'
        ? '06'
        : kind && values.changeType
          ? '05'
          : null;
    }
    if (kind === 'recruit' || kind === 'intro') return '05';
    return null;
  })();

  return (
    <FormShell title={TITLE} lede={LEDE}>
      <SubmitProgressOverlay open={submitting} progress={progress} />
      <FormStack onSubmit={onSubmit}>
        <FormQuestion index="01" label="社团名" required>
          <Input
            value={values.name}
            onChange={(ev) => setField('name', ev.target.value)}
            placeholder="正式名称"
            autoComplete="off"
          />
        </FormQuestion>

        <FormQuestion index="02" label="社团所属" required>
          <FormChoice
            value={values.affiliation}
            options={AFFILIATION_OPTIONS}
            columns={1}
            onChange={(v) => setField('affiliation', v)}
            aria-label="社团所属"
          />
        </FormQuestion>

        <FormQuestion index="03" label="要更新的信息" required>
          <FormChoice
            value={values.updateKind}
            options={UPDATE_KIND_OPTIONS}
            columns={1}
            onChange={(v) => {
              setField('updateKind', v);
              setField('changeType', '');
              setField('formerName', '');
              setField('recruitGroup', '');
              setField('intro', '');
            }}
            aria-label="要更新的信息"
          />
        </FormQuestion>

        {kind === 'change' && iChangeType ? (
          <FormQuestion index={iChangeType} label="变动类型" required>
            <FormChoice
              value={values.changeType}
              options={CHANGE_TYPE_OPTIONS}
              columns={1}
              onChange={(v) => {
                setField('changeType', v);
                if (v !== 'rename') setField('formerName', '');
              }}
              aria-label="变动类型"
            />
          </FormQuestion>
        ) : null}

        {kind === 'change' && values.changeType === 'rename' && iFormer ? (
          <FormQuestion index={iFormer} label="原社团名称" required>
            <Input
              value={values.formerName}
              onChange={(ev) => setField('formerName', ev.target.value)}
              autoComplete="off"
            />
          </FormQuestion>
        ) : null}

        {kind === 'recruit' && iRecruit ? (
          <FormQuestion index={iRecruit} label="纳新群号" required>
            <Input
              value={values.recruitGroup}
              onChange={(ev) => setField('recruitGroup', ev.target.value)}
              placeholder="QQ 群号等"
              autoComplete="off"
            />
          </FormQuestion>
        ) : null}

        {kind === 'intro' && iIntro ? (
          <FormQuestion
            index={iIntro}
            label="简介内容"
            required
            hint="格式我们会自行调整。"
          >
            <Textarea
              value={values.intro}
              onChange={(ev) => setField('intro', ev.target.value)}
              placeholder="社团简介正文"
            />
          </FormQuestion>
        ) : null}

        {kind && iContact ? (
          <FormQuestion
            index={iContact}
            label="您的联系方式是"
            required={kind !== 'recruit'}
            hint="以便进行后续交流。"
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
        ) : null}

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
