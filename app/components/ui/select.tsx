import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { cn } from '~/lib/cn';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type Props<T extends string> = {
  value: T | null;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  variant?: 'field' | 'compact' | 'input-group';
  className?: string;
};

const triggerVariants = {
  field:
    'h-10 min-w-24 rounded-md border border-line bg-panel px-3 text-sm hover:bg-mist focus-visible:border-primary',
  compact:
    'h-8 min-w-24 rounded border border-line bg-panel px-2.5 text-xs hover:bg-mist focus-visible:border-primary',
  'input-group':
    'h-full min-w-[5.75rem] border-0 border-r border-line bg-transparent px-3 text-sm hover:bg-mist focus-visible:bg-mist',
} as const;

export const SelectField = <T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = '选择',
  variant = 'field',
  className,
}: Props<T>) => {
  const selectedIcon = options.find((option) => option.value === value)?.icon;
  const items = useMemo(
    () =>
      Object.fromEntries(options.map((option) => [option.value, option.label])),
    [options],
  );

  return (
    <BaseSelect.Root
      value={value}
      items={items}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next as T);
      }}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex shrink-0 items-center justify-between gap-2 text-ink outline-none transition-colors data-[popup-open]:bg-mist',
          triggerVariants[variant],
          className,
        )}
      >
        {selectedIcon ? (
          <span className="flex shrink-0 text-icon" aria-hidden>
            {selectedIcon}
          </span>
        ) : null}
        <BaseSelect.Value
          placeholder={placeholder}
          className="min-w-0 flex-1 truncate data-[placeholder]:text-muted"
        />
        <BaseSelect.Icon className="flex shrink-0 text-icon">
          <ChevronDown size={14} strokeWidth={2} aria-hidden />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="z-[80] outline-none"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup className="max-h-72 w-max min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-md border border-line bg-panel py-1 shadow-[0_10px_30px_rgba(15,23,42,0.12)] outline-none">
            <BaseSelect.List className="outline-none">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  className="group flex min-w-max cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-sm whitespace-nowrap text-ink outline-none select-none data-[highlighted]:bg-primary-soft data-[selected]:font-medium"
                >
                  <span
                    className="flex w-3 shrink-0 text-primary opacity-0 group-data-[selected]:opacity-100"
                    aria-hidden
                  >
                    <Check size={10} strokeWidth={2.5} />
                  </span>
                  {option.icon ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-icon">
                      {option.icon}
                    </span>
                  ) : null}
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
};
