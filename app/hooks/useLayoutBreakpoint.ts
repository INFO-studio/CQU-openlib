import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { LAYOUT_BREAKPOINTS, type LayoutBreakpoint } from '~/theme/breakpoints';

export type BreakpointWay = 'lt' | 'gt' | 'elt' | 'egt';
export type BreakpointMatches = Readonly<Record<BreakpointWay, boolean>>;

const STRICT_OFFSET_PX = 0.02;
const getServerSnapshot = () => false;

const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

type UseLayoutBreakpoint = {
  (size: LayoutBreakpoint): BreakpointMatches;
  (size: LayoutBreakpoint, way: BreakpointWay): boolean;
};

export const useLayoutBreakpoint: UseLayoutBreakpoint = ((
  size: LayoutBreakpoint,
  way?: BreakpointWay,
) => {
  const breakpoint = Number.parseFloat(LAYOUT_BREAKPOINTS[size]);
  const egt = useMediaQuery(`(min-width: ${breakpoint}px)`);
  const gt = useMediaQuery(`(min-width: ${breakpoint + STRICT_OFFSET_PX}px)`);
  const matches = useMemo(() => ({ lt: !egt, gt, elt: !gt, egt }), [egt, gt]);
  return way ? matches[way] : matches;
}) as UseLayoutBreakpoint;
