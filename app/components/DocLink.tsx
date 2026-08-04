import { useNavigate } from '@tanstack/react-router';
import type { MouseEvent, ReactNode } from 'react';
import { cleanPath, toNavTarget } from '~/lib/paths';

type Props = {
  path: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  /** Default false so browser back/forward works. */
  replace?: boolean;
  /** Marks the current page for scroll-into-view helpers. */
  'data-active'?: 'true';
  'aria-current'?: 'page';
};

/** Soft navigation: client route change + content reload (no full page refresh). */
const DocLink = ({
  path,
  className,
  children,
  onNavigate,
  replace = false,
  'data-active': dataActive,
  'aria-current': ariaCurrent,
}: Props) => {
  const navigate = useNavigate();
  const href = cleanPath(path);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    onNavigate?.();
    const target = toNavTarget(href);
    if (target.to === '/') {
      void navigate({ to: '/', hash: target.hash, replace });
    } else if (target.to === '/map') {
      void navigate({
        to: '/map',
        search: target.search,
        hash: target.hash,
        replace,
      });
    } else {
      void navigate({
        to: '/$',
        params: target.params,
        hash: target.hash,
        replace,
      });
    }
  };

  return (
    <a
      href={href}
      className={className}
      onClick={onClick}
      data-active={dataActive}
      aria-current={ariaCurrent}
    >
      {children}
    </a>
  );
};
export default DocLink;
