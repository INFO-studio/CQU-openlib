import { Dialog } from '@base-ui/react/dialog';
import { FilterX, ListFilter, X } from 'lucide-react';
import { useState } from 'react';
import { SelectField, type SelectOption } from '~/components/ui/select';
import type { GraduationManifest, Scope } from '../types';
import { EMPTY_SCOPE, isScopeEmpty } from '../utils/scopeSearch';

/** Sentinel for 「不限」, since SelectField speaks in plain strings. */
const ANY = '__any__';

type Props = {
  manifest: GraduationManifest;
  scope: Scope;
  onChange: (next: Scope) => void;
};

type Field = {
  key: keyof Scope;
  label: string;
  value: string;
  options: SelectOption<string>[];
  apply: (value: string | null) => Scope;
  /** The widest option, so the row can size the control to fit its content. */
  width?: string;
};

/**
 * Every 「不限」 option names its own dimension (全部院系, not 全校), because a
 * bare SelectField shows only the current value — so with a neutral label there
 * is nothing on screen saying which facet the control belongs to.
 */
const buildFields = (manifest: GraduationManifest, scope: Scope): Field[] => [
  {
    key: 'collegeId',
    label: '院系',
    value: scope.collegeId ?? ANY,
    width: 'w-[11.5rem]',
    options: [
      { value: ANY, label: '全部院系' },
      ...manifest.colleges.map((c) => ({ value: c.id, label: c.name })),
    ],
    apply: (value) => ({ ...scope, collegeId: value }),
  },
  {
    key: 'education',
    label: '学历',
    value: scope.education ?? ANY,
    options: [
      { value: ANY, label: '全部学历' },
      ...manifest.educations.map((e) => ({ value: e, label: e })),
    ],
    apply: (value) => ({ ...scope, education: value }),
  },
  {
    key: 'grade',
    label: '毕业届次',
    value: scope.grade === null ? ANY : String(scope.grade),
    options: [
      { value: ANY, label: '全部届次' },
      ...manifest.grades.map((g) => ({ value: String(g), label: `${g} 届` })),
    ],
    apply: (value) => ({
      ...scope,
      grade: value === null ? null : Number(value),
    }),
  },
  {
    key: 'category',
    label: '去向类别',
    value: scope.category ?? ANY,
    options: [
      { value: ANY, label: '全部去向' },
      ...manifest.categories.map((c) => ({ value: c, label: c })),
    ],
    apply: (value) => ({ ...scope, category: value }),
  },
];

const activeCount = (scope: Scope): number =>
  [scope.collegeId, scope.education, scope.grade, scope.category].filter(
    (v) => v !== null,
  ).length;

/** Whatever the reader narrowed to, for the mobile trigger's own label. */
const summarise = (fields: Field[], scope: Scope): string => {
  const picked = fields
    .filter((f) => scope[f.key] !== null)
    .map((f) => f.options.find((o) => o.value === f.value)?.label ?? '');
  return picked.length === 0 ? '全部毕业生' : picked.join(' · ');
};

const ResetButton = ({
  disabled,
  onReset,
  className,
}: {
  disabled: boolean;
  onReset: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onReset}
    disabled={disabled}
    aria-label="清除筛选"
    title="清除筛选"
    className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-icon transition-colors hover:bg-mist hover:text-icon-strong disabled:pointer-events-none disabled:opacity-40 ${className ?? ''}`}
  >
    <FilterX size={15} aria-hidden />
  </button>
);

/**
 * One row of selects from md up; below that a single trigger opening a sheet.
 *
 * The row used to scroll sideways on narrow screens, which hid three of the
 * four facets behind a gesture nothing on screen advertised. The sheet borrows
 * the map's mobile pattern so the same interaction means the same thing twice.
 */
const ScopeBar = ({ manifest, scope, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const fields = buildFields(manifest, scope);
  const pristine = isScopeEmpty(scope);
  const count = activeCount(scope);

  const select = (field: Field, raw: string) =>
    onChange(field.apply(raw === ANY ? null : raw));

  return (
    <>
      <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
        {fields.map((field) => (
          <SelectField
            key={field.key}
            value={field.value}
            options={field.options}
            ariaLabel={field.label}
            onValueChange={(value) => select(field, value)}
            className={field.width}
          />
        ))}
        <ResetButton
          disabled={pristine}
          onReset={() => onChange(EMPTY_SCOPE)}
          className="ml-auto"
        />
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-mist md:hidden">
          <ListFilter size={15} className="shrink-0 text-icon" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {summarise(fields, scope)}
          </span>
          {count > 0 ? (
            <span className="shrink-0 rounded-full bg-primary-soft px-1.5 text-xs font-medium text-primary tabular-nums">
              {count}
            </span>
          ) : null}
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-60 bg-backdrop" />
          <Dialog.Popup
            className="fixed right-0 bottom-0 left-0 z-61 flex flex-col gap-3 rounded-t-xl border-t border-line bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl outline-none"
            aria-label="筛选毕业去向"
          >
            <div className="flex items-center gap-2">
              <h2 className="m-0 flex-1 text-sm font-semibold text-ink">
                筛选
              </h2>
              <ResetButton
                disabled={pristine}
                onReset={() => onChange(EMPTY_SCOPE)}
              />
              <Dialog.Close
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-icon transition-colors hover:bg-mist hover:text-icon-strong"
                aria-label="关闭"
              >
                <X size={16} aria-hidden />
              </Dialog.Close>
            </div>

            {/* Not a <label>: SelectField renders a button and a popup, not a
                form control, so the name is carried by its aria-label. */}
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">{field.label}</span>
                <SelectField
                  value={field.value}
                  options={field.options}
                  ariaLabel={field.label}
                  onValueChange={(value) => select(field, value)}
                  className="w-full"
                />
              </div>
            ))}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};

export default ScopeBar;
