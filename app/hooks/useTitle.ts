import { useEffect } from 'react';

const SITE_TITLE = 'CQU-openlib';
const SITE_TITLE_SUFFIX = ` · ${SITE_TITLE}`;

export const formatTitle = (title: string): string =>
  title === SITE_TITLE || title === '首页'
    ? SITE_TITLE
    : `${title}${SITE_TITLE_SUFFIX}`;

export const useTitle = (title: string | undefined): void => {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    const next = formatTitle(title);
    if (previous !== next) document.title = next;

    return () => {
      if (document.title === next) document.title = previous;
    };
  }, [title]);
};
