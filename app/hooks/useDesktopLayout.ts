import { useLayoutBreakpoint } from './useLayoutBreakpoint';

export const useDesktopLayout = (): boolean => useLayoutBreakpoint('md', 'egt');
