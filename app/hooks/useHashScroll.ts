import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { decodePathname } from '~/lib/paths';

/** How far above the target the page lands before easing down onto it. */
const RUN_UP_PX = 320;

type HashScrollEntry = {
  pathname: string;
  hash: string;
  handled: boolean;
};

export const captureInitialHash = (
  entry: HashScrollEntry,
  location: Pick<HashScrollEntry, 'pathname' | 'hash'>,
): HashScrollEntry =>
  entry.pathname === location.pathname
    ? entry
    : { pathname: location.pathname, hash: location.hash, handled: false };

/** Distance the sticky header claims, declared once as scroll-padding-top. */
const scrollPadding = (): number =>
  Number.parseFloat(
    getComputedStyle(document.documentElement).scrollPaddingTop,
  ) || 0;

/**
 * The document body arrives after the browser's initial fragment jump. Capture
 * that entry hash once per page and replay it after the async body is ready.
 * Later in-page hash changes are native anchor navigation and must not replay
 * the run-up animation.
 */
export const useHashScroll = (ready: boolean) => {
  const location = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      hash: state.location.hash,
    }),
  });
  const entry = useRef<HashScrollEntry>({ ...location, handled: false });
  entry.current = captureInitialHash(entry.current, location);

  useEffect(() => {
    if (!ready || entry.current.handled) return;
    entry.current.handled = true;

    const raw = entry.current.hash.replace(/^#/, '');
    if (!raw) return;
    const el =
      document.getElementById(decodePathname(raw)) ??
      document.getElementById(raw);
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollIntoView({ behavior: 'instant' });
      return;
    }

    const finalY = window.scrollY + el.getBoundingClientRect().top;
    const runUp = Math.max(0, finalY - scrollPadding() - RUN_UP_PX);
    window.scrollTo({ top: runUp, behavior: 'instant' });

    const frame = requestAnimationFrame(() =>
      el.scrollIntoView({ behavior: 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, ready]);
};
