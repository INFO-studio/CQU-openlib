import type { InputHTMLAttributes } from 'react';
import { SelectField, type SelectOption } from '~/components/ui/select';
import { cn } from '~/lib/cn';

export type InputGroupOption<T extends string> = SelectOption<T>;

type Props<T extends string> = {
  options: readonly InputGroupOption<T>[];
  selectValue: T | '';
  onSelectChange: (value: T) => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>;
  className?: string;
  /** Accessible name for the leading select. */
  selectLabel?: string;
};

/**
 * Leading Base UI Select + text input in one field chrome.
 * Equal height; chevron on the select trigger.
 */
export const InputGroup = <T extends string>({
  options,
  selectValue,
  onSelectChange,
  inputProps,
  className,
  selectLabel = '类型',
}: Props<T>) => {
  return (
    <div
      className={cn(
        'cquol-input-group mt-2 flex h-11 w-full items-stretch overflow-hidden rounded-md border border-line bg-panel transition-colors',
        'focus-within:border-primary',
        className,
      )}
    >
      <SelectField
        value={selectValue || null}
        options={options}
        onValueChange={onSelectChange}
        ariaLabel={selectLabel}
        variant="input-group"
      />

      <input
        {...inputProps}
        className={cn(
          'h-full min-w-0 flex-1 border-0 bg-transparent px-3.5 text-sm text-ink',
          'outline-none placeholder:text-muted/70',
        )}
      />
    </div>
  );
};
