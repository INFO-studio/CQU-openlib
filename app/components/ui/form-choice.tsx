import { cn } from '~/lib/cn';

export type FormChoiceOption<T extends string> = {
  value: T;
  label: string;
};

type OtherSlot<T extends string> = {
  /** Which option hosts the inline text field. */
  value: T;
  text: string;
  onTextChange: (text: string) => void;
  placeholder?: string;
};

type Props<T extends string> = {
  value: T | '';
  options: readonly FormChoiceOption<T>[];
  onChange: (value: T) => void;
  /** Grid columns; `1` stacks as a vertical radio list. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Render an input inside one option (e.g. 「其他」注明). */
  other?: OtherSlot<T>;
  'aria-label'?: string;
  className?: string;
};

const colClass: Record<NonNullable<Props<string>['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-3 sm:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3',
};

export const FormChoice = <T extends string>({
  value,
  options,
  onChange,
  columns = 2,
  other,
  'aria-label': ariaLabel,
  className,
}: Props<T>) => {
  return (
    <div
      className={cn('mt-3 grid gap-2', colClass[columns], className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        const isOther = other && opt.value === other.value;

        return (
          <div
            key={opt.value}
            className={cn(
              'flex items-center gap-2.5 rounded-md border px-3 py-3 text-left text-sm transition-colors',
              selected
                ? 'border-primary bg-primary-soft text-ink'
                : 'border-line bg-panel text-muted hover:border-primary/40 hover:text-ink',
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => onChange(opt.value)}
            >
              <span
                className={cn(
                  'box-border h-4 w-4 shrink-0 rounded-full border-[1.5px]',
                  selected
                    ? 'border-primary shadow-[inset_0_0_0_0.28rem_var(--c-primary)]'
                    : 'border-current opacity-55',
                )}
                aria-hidden="true"
              />
              <span className="shrink-0 font-medium">{opt.label}</span>
            </button>

            {isOther ? (
              <input
                type="text"
                value={other.text}
                placeholder={other.placeholder ?? '请注明'}
                aria-label={other.placeholder ?? '请注明'}
                className={cn(
                  'min-w-0 flex-1 rounded border-0 bg-transparent px-0 py-0 text-sm text-ink outline-none placeholder:text-muted/70',
                  'focus:outline-none',
                )}
                onFocus={() => {
                  if (!selected) onChange(opt.value);
                }}
                onChange={(ev) => {
                  if (!selected) onChange(opt.value);
                  other.onTextChange(ev.target.value);
                }}
                onClick={(ev) => ev.stopPropagation()}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const YES_NO_OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
] as const satisfies readonly FormChoiceOption<'yes' | 'no'>[];
