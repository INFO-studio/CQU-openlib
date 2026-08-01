import type { FormEvent } from 'react';
import { FormPage } from '~/components/forms/FormPage';
import { FormChoice } from '~/components/ui/form-choice';
import { Input } from '~/components/ui/input';
import { InputGroup } from '~/components/ui/input-group';
import { Textarea } from '~/components/ui/textarea';
import { useFormDraft } from '~/hooks/useFormDraft';
import { useFormSubmit } from '~/hooks/useFormSubmit';
import {
  CONTACT_KIND_OPTIONS,
  type ContactKind,
  contactInputMode,
  contactPlaceholder,
  validateContactFields,
} from '~/lib/formContact';
import {
  type FormItemInput,
  question,
  requireChoice,
  requireText,
} from '~/lib/formItems';

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

export const ClubForm = () => {
  const { values, setField, setValues, clear } = useFormDraft({
    slug: 'club',
    defaults: DEFAULTS,
  });
  const form = useFormSubmit('club');

  const kind = values.updateKind;
  const isRename = kind === 'change' && values.changeType === 'rename';
  // 纳新群号只需群号，联系方式可选；变动类型未选时先不问联系方式。
  const showContact = kind === 'change' ? !!values.changeType : !!kind;
  const contactRequired = kind !== 'recruit';

  const items: FormItemInput[] = [
    question({
      key: 'name',
      label: '社团名',
      required: true,
      validate: requireText(values.name, '请填写社团名'),
      children: (
        <Input
          value={values.name}
          onChange={(ev) => setField('name', ev.target.value)}
          placeholder="正式名称"
          autoComplete="off"
        />
      ),
    }),

    question({
      key: 'affiliation',
      label: '社团所属',
      required: true,
      validate: requireChoice(values.affiliation, '请选择社团所属'),
      children: (
        <FormChoice
          value={values.affiliation}
          options={AFFILIATION_OPTIONS}
          columns={1}
          onChange={(v) => setField('affiliation', v)}
          aria-label="社团所属"
        />
      ),
    }),

    question({
      key: 'updateKind',
      label: '要更新的信息',
      required: true,
      validate: requireChoice(values.updateKind, '请选择要更新的信息'),
      children: (
        <FormChoice
          value={values.updateKind}
          options={UPDATE_KIND_OPTIONS}
          columns={1}
          onChange={(v) =>
            setValues((prev) => ({
              ...prev,
              updateKind: v,
              changeType: '',
              formerName: '',
              recruitGroup: '',
              intro: '',
            }))
          }
          aria-label="要更新的信息"
        />
      ),
    }),

    kind === 'change' &&
      question({
        key: 'changeType',
        label: '变动类型',
        required: true,
        validate: requireChoice(values.changeType, '请选择变动类型'),
        children: (
          <FormChoice
            value={values.changeType}
            options={CHANGE_TYPE_OPTIONS}
            columns={1}
            onChange={(v) =>
              setValues((prev) => ({
                ...prev,
                changeType: v,
                ...(v !== 'rename' ? { formerName: '' } : {}),
              }))
            }
            aria-label="变动类型"
          />
        ),
      }),

    isRename &&
      question({
        key: 'formerName',
        label: '原社团名称',
        required: true,
        validate: requireText(values.formerName, '请填写原社团名称'),
        children: (
          <Input
            value={values.formerName}
            onChange={(ev) => setField('formerName', ev.target.value)}
            autoComplete="off"
          />
        ),
      }),

    kind === 'recruit' &&
      question({
        key: 'recruitGroup',
        label: '纳新群号',
        required: true,
        validate: requireText(values.recruitGroup, '请填写纳新群号'),
        children: (
          <Input
            value={values.recruitGroup}
            onChange={(ev) => setField('recruitGroup', ev.target.value)}
            placeholder="QQ 群号等"
            autoComplete="off"
          />
        ),
      }),

    kind === 'intro' &&
      question({
        key: 'intro',
        label: '简介内容',
        required: true,
        hint: '格式我们会自行调整。',
        validate: requireText(values.intro, '请填写简介内容'),
        children: (
          <Textarea
            value={values.intro}
            onChange={(ev) => setField('intro', ev.target.value)}
            placeholder="社团简介正文"
          />
        ),
      }),

    showContact &&
      question({
        key: 'contact',
        label: '您的联系方式是',
        required: contactRequired,
        hint: '以便进行后续交流。',
        validate: () =>
          contactRequired
            ? validateContactFields(values.contactKind, values.contact)
            : null,
        children: (
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
        ),
      }),
  ];

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void form.submit({
      items,
      buildPayload: () => ({
        name: values.name.trim(),
        affiliation: values.affiliation,
        updateKind: values.updateKind,
        changeType: kind === 'change' ? values.changeType : '',
        formerName: isRename ? values.formerName.trim() : '',
        recruitGroup: kind === 'recruit' ? values.recruitGroup.trim() : '',
        intro: kind === 'intro' ? values.intro.trim() : '',
        contactKind: values.contactKind,
        contact: values.contact.trim(),
      }),
      onSuccess: clear,
    });
  };

  return (
    <FormPage
      slug="club"
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
