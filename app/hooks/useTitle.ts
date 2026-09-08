import { useEffect } from 'react';

const SITE_TITLE = 'CQU-openlib';
const SITE_TITLE_SUFFIX = ` · ${SITE_TITLE}`;

export const formatTitle = (title: string | null): string =>
  title === null ? SITE_TITLE : `${title}${SITE_TITLE_SUFFIX}`;

export const useTitle = (title: string | null | undefined): void => {
  useEffect(() => {
    if (title === undefined) return;
    const previous = document.title;
    const next = formatTitle(title);
    if (previous !== next) document.title = next;

    return () => {
      if (document.title === next) document.title = previous;
    };
  }, [title]);
};
