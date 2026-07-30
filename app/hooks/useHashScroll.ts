import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

/** Heading ids keep CJK, so the address bar carries a percent-encoded hash. */
const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** How far above the target the page lands before easing down onto it. */
const RUN_UP_PX = 320;

/** Distance the sticky header claims, declared once as `scroll-padding-top`. */
const scrollPadding = (): number =>
  Number.parseFloat(
    getComputedStyle(document.documentElement).scrollPaddingTop,
  ) || 0;

/**
 * Docs arrive from an async fetch, so the browser runs its own fragment scroll
 * while the page is still a skeleton and finds nothing. Re-run it once the
 * target actually exists.
 *
 * @param ready whether the document body has rendered
 */
export const useHashScroll = (ready: boolean) => {
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    if (!ready) return;
    const raw = hash.replace(/^#/, '');
    if (!raw) return;
    const el =
      document.getElementById(decode(raw)) ?? document.getElementById(raw);
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollIntoView({ behavior: 'instant' });
      return;
    }

    // Easing all the way from the top of a long doc reads as a glitch, and
    // landing hard on the anchor loses the sense of where it sits. Jump to just
    // above the target, then let the browser ease the last stretch.
    const finalY = window.scrollY + el.getBoundingClientRect().top;
    const runUp = Math.max(0, finalY - scrollPadding() - RUN_UP_PX);
    window.scrollTo({ top: runUp, behavior: 'instant' });

    // Same-task scrolls get coalesced, so hand the smooth leg to the next frame.
    const frame = requestAnimationFrame(() =>
      el.scrollIntoView({ behavior: 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [hash, ready]);
};
