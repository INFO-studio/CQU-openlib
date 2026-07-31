import {
  ArrowLeft,
  ArrowRight,
  Book,
  BookOpen,
  Building2,
  Calendar,
  CircleArrowUp,
  FileText,
  Frown,
  GalleryVerticalEnd,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  Printer,
  Quote,
  ScanBarcode,
  Tag,
  User,
} from 'lucide-react';
import { resolveLucideIconName } from '~/lib/icons';
import type { MnIcon } from '~/types/mdast';

/**
 * Every icon used by `public/doc/**`. Explicit so the bundle only ships what the
 * corpus needs; `iconCoverage.test.ts` fails if a doc uses an unlisted icon.
 */
export const STATIC_ICONS: Record<string, LucideIcon> = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  book: Book,
  'book-open': BookOpen,
  'building-2': Building2,
  calendar: Calendar,
  'circle-arrow-up': CircleArrowUp,
  'file-text': FileText,
  frown: Frown,
  'gallery-vertical-end': GalleryVerticalEnd,
  'list-checks': ListChecks,
  'message-square-text': MessageSquareText,
  printer: Printer,
  quote: Quote,
  'scan-barcode': ScanBarcode,
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
