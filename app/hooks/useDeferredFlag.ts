import { useEffect, useState } from 'react';
export const useDeferredFlag = (flag: boolean, delayMs = 500): boolean => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) {
      setShown(false);
      return;
    }
    const id = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(id);
  }, [flag, delayMs]);
  return shown;
};
