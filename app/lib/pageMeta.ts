export const SITE_TITLE = 'CQU-openlib';
export const SITE_ORIGIN = 'https://cqu-openlib.cn';
export const SITE_DESCRIPTION =
  '重庆大学资源共享计划 CQU-openlib，非官方、非营利的校园资源文档站。';

export const formatTitle = (title: string | null): string =>
  title === null ? SITE_TITLE : `${title} · ${SITE_TITLE}`;

export const defaultDescription = (title: string | null): string =>
  title === null
    ? SITE_DESCRIPTION
    : `${title}，重庆大学资源共享计划 CQU-openlib 校园资源文档。`;

export const canonicalUrl = (pathname: string): string =>
  new URL(pathname || '/', SITE_ORIGIN).href;
