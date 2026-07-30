import { ArrowRight } from 'lucide-react';
import DocLink from '~/components/DocLink';

/**
 * Homepage entry to the manual. Lives on the title row's right edge so it
 * costs no vertical space. Every other accent on this page is a pastel
 * callout — solid ink is what reads as the one thing to click. Ink and paper
 * swap with the theme, so the pill stays legible in both without a second rule.
 */
const HomeManualLink = () => (
  <DocLink
    path="/sundry/说明书"
    className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-medium text-paper no-underline transition-colors hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    说明书
    <ArrowRight
      size={14}
      className="transition-transform group-hover:translate-x-0.5"
    />
  </DocLink>
);
export default HomeManualLink;
