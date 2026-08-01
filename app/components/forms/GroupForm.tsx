import type { FormEvent } from 'react';
import { FormPage } from '~/components/forms/FormPage';
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
import { type FormItemInput, question, requireText } from '~/lib/formItems';

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

export const GroupForm = () => {
  const { values, setField, clear } = useFormDraft({
    slug: 'group',
    defaults: DEFAULTS,
  });
  const form = useFormSubmit('group');

  const items: FormItemInput[] = [
    question({
      key: 'name',
      label: '团体名称',
      required: true,
      validate: requireText(values.name, '请填写团体名称'),
      children: (
        <Input
          value={values.name}
          onChange={(ev) => setField('name', ev.target.value)}
          placeholder="对外常用名称"
          autoComplete="off"
        />
      ),
    }),

    question({
      key: 'intro',
      label: '简介',
      required: true,
      validate: requireText(values.intro, '请填写简介'),
      children: (
        <Textarea
          value={values.intro}
          onChange={(ev) => setField('intro', ev.target.value)}
          placeholder="团体主题、活动或定位"
        />
      ),
    }),

    question({
      key: 'qqGroup',
      label: 'QQ 群号',
      required: true,
      validate: requireText(values.qqGroup, '请填写 QQ 群号'),
      children: (
        <Input
          value={values.qqGroup}
          onChange={(ev) => setField('qqGroup', ev.target.value)}
          placeholder="公开纳新或常驻群号"
          inputMode="numeric"
          autoComplete="off"
        />
      ),
    }),

    question({
      key: 'contact',
      label: '您的联系方式是',
      required: true,
      hint: '以便审核时沟通。',
      validate: () => validateContactFields(values.contactKind, values.contact),
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
        intro: values.intro.trim(),
        qqGroup: values.qqGroup.trim(),
        contactKind: values.contactKind,
        contact: values.contact.trim(),
      }),
      onSuccess: clear,
    });
  };

  return (
    <FormPage
      slug="group"
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
