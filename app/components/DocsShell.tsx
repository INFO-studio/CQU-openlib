import { useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect, useMemo } from 'react';
import CourseSidebar from '~/components/CourseSidebar';
import MobileNavDrawer from '~/components/MobileNavDrawer';
import NavLoadError from '~/components/NavLoadError';
import SearchDialog from '~/components/SearchDialog';
import Sidebar from '~/components/Sidebar';
import SiteHeader from '~/components/SiteHeader';
import Toc, { type TocItem } from '~/components/Toc';
import { NavSkeleton } from '~/components/ui/skeleton';
import { useDeferredFlag } from '~/hooks/useDeferredFlag';
import { cn } from '~/lib/cn';
import { sectionForPath } from '~/lib/nav';
import { cleanPath, decodePathname } from '~/lib/paths';
import { useNavIndex } from '~/queries/nav';
import { useUiStore } from '~/stores/uiStore';

type Props = {
  children: ReactNode;
  toc?: TocItem[];
  /** Desktop left column slot (e.g. form back). Hidden on mobile. */
  leftRail?: ReactNode;
  /** Keep site chrome while allowing an app-like page to own the full body. */
  fullBleed?: boolean;
};

const DocsShell = ({
  children,
  toc = [],
  leftRail,
  fullBleed = false,
}: Props) => {
  const pathname = useRouterState({
    select: (s) => cleanPath(decodePathname(s.location.pathname)),
  });
  const { data: index, error, isPending, isError, refetch } = useNavIndex();
  const loading = isPending && !index;
  const errorMessage =
    isError && !index
      ? error instanceof Error
        ? error.message
        : '目录加载失败'
      : null;
  const { searchOpen, openSearch, closeSearch, sidebarOpen, closeSidebar } =
    useUiStore();

  const section = useMemo(() => sectionForPath(pathname), [pathname]);
  const sectionData = index?.sections.find((s) => s.id === section?.id);
  const isCourse = section?.id === 'course';
  const wantsSidebar = Boolean(section);
  const hasSidebar = Boolean(
    section && sectionData && sectionData.tree.length > 0,
  );
  const showNavSkeleton = useDeferredFlag(loading);
  const showSidebarChrome =
    wantsSidebar && (loading || Boolean(errorMessage) || hasSidebar);
  const showLeftRail = Boolean(leftRail);
  const showLeftColumn = showSidebarChrome || showLeftRail;
  const hasToc = toc.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch]);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  const sidebarBody = (() => {
    if (!wantsSidebar) return null;
    if (loading) {
      return showNavSkeleton ? <NavSkeleton course={isCourse} /> : null;
    }
    if (errorMessage) {
      return (
        <NavLoadError message={errorMessage} onRetry={() => void refetch()} />
      );
    }
    if (hasSidebar && isCourse && sectionData) {
      return <CourseSidebar tree={sectionData.tree} currentPath={pathname} />;
    }
    if (hasSidebar && !isCourse && section && sectionData) {
      return (
        <Sidebar
          title={section.label}
          sectionPath={section.path}
          tree={sectionData.tree}
          currentPath={pathname}
        />
      );
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-paper text-ink font-sans antialiased">
      <SiteHeader currentPath={pathname} />

      {/*
        Fixed 3-column shell: sidebar | main | toc.
        column-gap keeps main ↔ nav / 本页 gutters equal.
      */}
      <div
        className={cn(
          'mx-auto grid w-full grid-cols-1',
          fullBleed
            ? 'max-w-none'
            : 'max-w-[96rem] gap-x-shell px-3 md:px-5 lg:grid-cols-docs xl:grid-cols-docs-toc',
        )}
      >
        {fullBleed ? null : (
          <aside
            className={cn(
              // Desktop: top pad matches main (2× the old py-2); mobile drawer untouched.
              'hidden lg:sticky lg:top-header lg:block lg:h-under-header lg:pt-4 lg:pb-2',
              isCourse && hasSidebar && !loading && !errorMessage
                ? 'lg:flex lg:flex-col lg:overflow-hidden'
                : showLeftRail
                  ? 'lg:flex lg:items-start lg:justify-end lg:overflow-visible'
                  : 'lg:overflow-y-auto',
              showLeftColumn
                ? undefined
                : 'lg:invisible lg:pointer-events-none',
            )}
          >
            {showLeftRail ? leftRail : sidebarBody}
          </aside>
        )}

        <main className={cn('min-w-0', fullBleed ? 'p-0' : 'py-3 lg:pt-4')}>
          {children}
        </main>

        {fullBleed ? null : (
          <aside
            className={cn(
              'sticky top-header-toc hidden h-under-header-toc overflow-y-auto pt-4 pb-2 xl:block',
              hasToc ? undefined : 'xl:invisible xl:pointer-events-none',
            )}
          >
            {hasToc ? <Toc items={toc} /> : null}
          </aside>
        )}
      </div>

      <MobileNavDrawer
        open={sidebarOpen}
        onClose={closeSidebar}
        pathname={pathname}
        index={index ?? null}
        navLoading={loading}
        navError={errorMessage}
        onRetryNav={() => void refetch()}
      />

      <SearchDialog
        chunks={index?.searchManifest.chunks ?? []}
        open={searchOpen}
        onClose={closeSearch}
      />
    </div>
  );
};
export default DocsShell;
