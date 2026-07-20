import {
  ArrowLeft,
  ArrowRight,
  Book,
  Building2,
  Calendar,
  CircleArrowUp,
  FileText,
  Frown,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  Printer,
  Quote,
  Tag,
  User,
} from 'lucide-react';
import { resolveLucideIconName } from '~/lib/icons';
import type { MnIcon } from '~/types/mdast';

/** Sync map for icons that appear across the corpus — keeps SSR/tests stable. */
const STATIC_ICONS: Record<string, LucideIcon> = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  book: Book,
  'building-2': Building2,
  calendar: Calendar,
  'circle-arrow-up': CircleArrowUp,
  'file-text': FileText,
  frown: Frown,
  'list-checks': ListChecks,
  'message-square-text': MessageSquareText,
  printer: Printer,
  quote: Quote,
  tag: Tag,
  user: User,
};

const parserIcon = (mn: MnIcon) => {
  const name = resolveLucideIconName(mn.icon);
  const Icon = name ? STATIC_ICONS[name] : undefined;
  if (!Icon) {
    return <span className="text-muted">:{mn.icon}:</span>;
  }
  return (
    <Icon
      size="1em"
      className="inline-block align-[-0.125em] text-icon"
      aria-hidden
    />
  );
};

export default parserIcon;
