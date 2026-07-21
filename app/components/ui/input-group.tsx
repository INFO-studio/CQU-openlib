import { Select } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { useMemo } from 'react';
import { cn } from '~/lib/cn';

export type InputGroupOption<T extends string> = {
  value: T;
  label: string;
};

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
  const items = useMemo(
    () => Object.fromEntries(options.map((o) => [o.value, o.label])),
    [options],
  );

  return (
    <div
      className={cn(
        'mt-2 flex h-11 w-full items-stretch overflow-hidden rounded-md border border-line bg-panel transition-colors',
        'focus-within:border-primary',
        className,
      )}
    >
      <Select.Root
        value={selectValue || null}
        items={items}
        onValueChange={(next) => {
          if (typeof next === 'string' && next) onSelectChange(next as T);
        }}
      >
        <Select.Trigger
          aria-label={selectLabel}
          className={cn(
            'inline-flex h-full min-w-[5.75rem] shrink-0 items-center justify-between gap-1.5',
            'border-0 border-r border-line bg-transparent px-3 text-sm text-ink',
            'outline-none transition-colors',
            'hover:bg-mist data-[popup-open]:bg-mist',
            'focus-visible:bg-mist',
          )}
        >
          <Select.Value
            placeholder="选择"
            className="min-w-0 truncate data-[placeholder]:text-muted"
          />
          <Select.Icon className="flex shrink-0 text-muted">
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner
            className="z-[80] outline-none"
            sideOffset={6}
            alignItemWithTrigger={false}
          >
            <Select.Popup
              className={cn(
                'min-w-[var(--anchor-width)] origin-[var(--transform-origin)]',
                'rounded-md border border-line bg-panel py-1',
                'shadow-[0_10px_30px_rgba(15,23,42,0.12)] outline-none',
              )}
            >
              <Select.List className="outline-none">
                {options.map((opt) => (
                  <Select.Item
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    className={cn(
                      'flex cursor-pointer items-center px-3 py-2 text-sm text-ink outline-none select-none',
                      'data-[highlighted]:bg-primary-soft',
                      'data-[selected]:font-medium',
                    )}
                  >
                    <Select.ItemText>{opt.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>

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
