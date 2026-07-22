import {
  AlertTriangle,
  BookOpen,
  Bug,
  Check,
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
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '~/lib/cn';
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

/** Maps to `--admonition-*` tokens in theme/tokens.css */
const COLOR_VAR: Record<MnAdmonitionType, string> = {
  note: 'var(--admonition-note)',
  abstract: 'var(--admonition-abstract)',
  info: 'var(--admonition-info)',
  tip: 'var(--admonition-tip)',
  success: 'var(--admonition-success)',
  question: 'var(--admonition-question)',
  warning: 'var(--admonition-warning)',
  failure: 'var(--admonition-failure)',
  danger: 'var(--admonition-danger)',
  bug: 'var(--admonition-bug)',
  example: 'var(--admonition-example)',
  quote: 'var(--admonition-quote)',
};

type Props = {
  type: MnAdmonitionType;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Extra nodes inside the title row (e.g. clear button). */
  titleAside?: ReactNode;
};

const Admonition = ({
  type,
  title,
  children,
  className,
  titleAside,
}: Props) => {
  const Icon = ICONS[type] ?? BookOpen;
  const hasTitle = title != null && title !== false;
  const hasContent = children != null && children !== false;
  const color = COLOR_VAR[type] ?? COLOR_VAR.note;
  const style = {
    '--admonition-color': color,
    '--admonition-bg': `color-mix(in srgb, ${color} 8%, var(--c-paper))`,
    '--admonition-title-bg': `color-mix(in srgb, ${color} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 35%, var(--c-line))`,
  } as CSSProperties;

  const icon = (
    <Icon
      size={16}
      strokeWidth={2}
      className="mt-[0.2em] shrink-0 text-[var(--admonition-color)]"
      aria-hidden
    />
  );

  if (!hasTitle && hasContent) {
    return (
      <div
        className={cn(
          'my-3 grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2 overflow-hidden rounded-[0.35rem] border border-l-[3px] border-l-[var(--admonition-color)] bg-[var(--admonition-bg)] px-[0.85rem] py-[0.7rem] text-sm text-ink',
          className,
        )}
        style={style}
      >
        {icon}
        <div className="min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'my-3 overflow-hidden rounded-[0.35rem] border border-l-[3px] border-l-[var(--admonition-color)] bg-[var(--admonition-bg)] text-sm text-ink',
        className,
      )}
      style={style}
    >
      {hasTitle ? (
        <div
          className={cn(
            'relative flex items-start gap-2 bg-[var(--admonition-title-bg)] px-[0.85rem] py-[0.55rem] text-sm font-semibold leading-[1.45]',
            titleAside ? 'pr-[4.75rem]' : undefined,
          )}
        >
          {icon}
          <span className="min-w-0 flex-1">{title}</span>
          {titleAside}
        </div>
      ) : null}
      {hasContent ? (
        <div className="flex min-h-0 flex-1 flex-col px-[0.85rem] pb-3 pt-[0.65rem] [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default Admonition;
