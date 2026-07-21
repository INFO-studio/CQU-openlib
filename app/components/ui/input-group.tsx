import type { ChangeEvent, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '~/lib/cn';
import { fieldClass } from '~/components/ui/input';

export type InputGroupOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly InputGroupOption<T>[];
  selectValue: T | '';
  onSelectChange: (value: T) => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>;
  selectProps?: Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    'className' | 'value' | 'onChange'
  >;
  className?: string;
  /** Accessible name for the leading select. */
  selectLabel?: string;
};

/**
 * Leading select + text input, sharing one field chrome.
 * Used for contact channel + value, etc.
 */
export const InputGroup = <T extends string>({
  options,
  selectValue,
  onSelectChange,
  inputProps,
  selectProps,
  className,
  selectLabel = '类型',
}: Props<T>) => {
  const onSelect = (ev: ChangeEvent<HTMLSelectElement>) => {
    onSelectChange(ev.target.value as T);
  };

  return (
    <div
      className={cn(
        fieldClass,
        'mt-2 flex items-stretch gap-0 overflow-hidden p-0 focus-within:border-primary',
        className,
      )}
    >
      <select
        {...selectProps}
        aria-label={selectLabel}
        value={selectValue}
        onChange={onSelect}
        className={cn(
          'shrink-0 border-0 border-r border-line bg-transparent px-3 py-2.5 text-sm text-ink outline-none',
          'focus:outline-none',
        )}
      >
        <option value="" disabled>
          选择
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        {...inputProps}
        className="min-w-0 flex-1 border-0 bg-transparent px-3.5 py-2.5 text-ink outline-none placeholder:text-muted/70 focus:outline-none"
      />
    </div>
  );
};
