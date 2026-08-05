import { Collapsible } from '@base-ui/react/collapsible';
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Check,
  ChevronRight,
  FileText,
  FlaskConical,
  HelpCircle,
  Info,
  Lightbulb,
  type LucideIcon,
  Pencil,
  Quote,
  X,
  Zap,
} from 'lucide-react';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { cn } from '~/lib/cn';
import { admonitionColors } from '~/theme/colors';
import type { MnAdmonitionType } from '~/types/mdast/mnAdmonition';

const ICONS: Record<MnAdmonitionType, LucideIcon> = {
  note: Pencil,
  abstract: FileText,
  info: Info,
  tip: Lightbulb,
  success: Check,
  question: HelpCircle,
  warning: AlertTriangle,
  failure: X,
  danger: Zap,
  bug: Bug,
  example: FlaskConical,
  quote: Quote,
};

/** Typed against the callout types so theme/colors.ts can't miss one. */
const COLOR_VAR: Record<MnAdmonitionType, string> = admonitionColors;

type CollapsibleShellProps = {
  shell: string;
  titleRow: string;
  style: CSSProperties;
  icon: ReactNode;
  title: ReactNode;
  body: ReactNode;
  titleAside?: ReactNode;
  defaultOpen: boolean;
  onToggle?: (open: boolean) => void;
};

const CollapsibleShell = ({
  shell,
  titleRow,
  style,
  icon,
  title,
  body,
  titleAside,
  defaultOpen,
  onToggle,
}: CollapsibleShellProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible.Root
      className={shell}
      style={style}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onToggle?.(next);
      }}
    >
      <div className="relative">
        <Collapsible.Trigger
          className={cn(
            titleRow,
            'w-full cursor-pointer select-none text-left',
          )}
        >
          {icon}
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronRight
            size={16}
            className={cn(
              'mt-[0.15em] shrink-0 text-callout transition-transform duration-150',
              open && 'rotate-90',
            )}
            aria-hidden
          />
        </Collapsible.Trigger>
        {titleAside}
      </div>
      <Collapsible.Panel
        hiddenUntilFound
        className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none"
      >
        {body}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};

type Props = {
  type: MnAdmonitionType;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Extra nodes inside the title row (e.g. clear button). */
  titleAside?: ReactNode;
  /** Material `???` / `???+`. */
  collapse?: 'closed' | 'open';
  /** Only ever called when `collapse` is set. */
  onToggle?: (open: boolean) => void;
};

const Admonition = ({
  type,
  title,
  children,
  className,
  titleAside,
  collapse,
  onToggle,
}: Props) => {
  const Icon = ICONS[type] ?? BookOpen;
  const hasTitle = title != null && title !== false;
  const hasContent = children != null && children !== false;
  const color = COLOR_VAR[type] ?? COLOR_VAR.note;
  // Fills the callout-* colors that uno.config.ts declares, so the classes
  // below stay plain utilities.
  const style = {
    '--callout': color,
    '--callout-bg': `color-mix(in srgb, ${color} 8%, var(--c-paper))`,
    '--callout-title': `color-mix(in srgb, ${color} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 35%, var(--c-line))`,
  } as CSSProperties;

  const icon = (
    <Icon
      size={16}
      strokeWidth={2}
      className="mt-[0.2em] shrink-0 text-callout"
      aria-hidden
    />
  );

  const shell = cn(
    'cquol-admonition my-3 overflow-hidden rounded-[0.35rem] border border-l-[3px] border-l-callout bg-callout-bg text-sm text-ink',
    className,
  );

  const titleRow = cn(
    'cquol-admonition__title relative flex items-start gap-2 bg-callout-title px-[0.85rem] py-[0.55rem] text-sm font-semibold leading-[1.45]',
    titleAside ? 'pr-[4.75rem]' : undefined,
  );

  const body = hasContent ? (
    <div className="cquol-admonition__body flex min-h-0 flex-1 flex-col px-[0.85rem] pb-3 pt-[0.65rem] [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      {children}
    </div>
  ) : null;

  if (collapse && hasTitle) {
    return (
      <CollapsibleShell
        shell={shell}
        titleRow={titleRow}
        style={style}
        icon={icon}
        title={title}
        body={body}
        titleAside={titleAside}
        defaultOpen={collapse === 'open'}
        onToggle={onToggle}
      />
    );
  }

  if (!hasTitle && hasContent) {
    return (
      <div
        className={cn(
          'cquol-admonition my-3 grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2 overflow-hidden rounded-[0.35rem] border border-l-[3px] border-l-callout bg-callout-bg px-[0.85rem] py-[0.7rem] text-sm text-ink',
          className,
        )}
        style={style}
      >
        {icon}
        <div className="cquol-admonition__body min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={shell} style={style}>
      {hasTitle ? (
        <div className={titleRow}>
          {icon}
          <span className="min-w-0 flex-1">{title}</span>
          {titleAside}
        </div>
      ) : null}
      {body}
    </div>
  );
};

export default Admonition;
