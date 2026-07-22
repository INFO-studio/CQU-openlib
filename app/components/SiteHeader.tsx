import { Github, Menu, Search } from 'lucide-react';
import DocLink from '~/components/DocLink';
import ThemeToggle from '~/components/ThemeToggle';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/cn';
import { NAV_SECTIONS_VISIBLE } from '~/lib/nav';
import { useUiStore } from '~/stores/uiStore';

const GITHUB_URL = 'https://github.com/INFO-studio/CQU-openlib';

type Props = {
  currentPath: string;
};

const SiteHeader = ({ currentPath }: Props) => {
  const { openSearch, openSidebar } = useUiStore();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur-md">
      <div className="mx-auto grid min-h-[var(--header-h)] w-full max-w-[96rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 min-[400px]:gap-3 min-[400px]:px-3 md:gap-[var(--shell-gap)] md:px-5 lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)_auto] xl:grid-cols-[var(--sidebar-w)_minmax(0,1fr)_var(--toc-w)]">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="icon"
            className="shrink-0 lg:hidden"
            aria-label="打开目录"
            onClick={openSidebar}
          >
            <Menu size={18} />
          </Button>

          <div className="min-w-0 flex-auto overflow-hidden">
            <DocLink
              path="/"
              className="group flex max-w-full min-w-0 items-center gap-2 no-underline"
            >
              <span
                className="relative inline-flex h-7 w-7 shrink-0 max-[320px]:hidden"
                aria-hidden
              >
                <img
                  src="/doc/assets/openlib-logo-light.svg"
                  alt=""
                  className="h-7 w-7 object-contain dark:hidden"
                />
                <img
                  src="/doc/assets/openlib-logo-dark.svg"
                  alt=""
                  className="hidden h-7 w-7 object-contain dark:block"
                />
              </span>
              <div className="min-w-0 overflow-hidden leading-[1.15]">
                <div className="truncate text-[0.9rem] font-semibold tracking-[-0.01em] text-ink">
                  重庆大学
                </div>
                <div className="truncate text-[0.68rem] font-medium text-muted">
                  资源共享计划
                </div>
              </div>
            </DocLink>
          </div>
        </div>

        <nav
          aria-label="主导航"
          className="hidden min-w-0 items-center gap-5 overflow-x-auto lg:flex xl:gap-6"
        >
          {NAV_SECTIONS_VISIBLE.map((section) => {
            const active =
              currentPath === section.path ||
              currentPath.startsWith(`${section.path}/`);
            return (
              <DocLink
                key={section.id}
                path={section.path}
                className={cn(
                  /* px + equal -mx: larger hit target, layout still looks unpadded */
                  'shrink-0 px-2 -mx-2 py-1 text-[0.8125rem] no-underline transition-colors',
                  active
                    ? 'font-bold text-ink'
                    : 'font-normal text-muted hover:text-ink',
                )}
              >
                {section.label}
              </DocLink>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-0.5">
          <Button
            onClick={openSearch}
            className="gap-2 sm:rounded-full sm:border sm:border-line sm:bg-mist/60 sm:px-2.5 sm:hover:bg-mist"
          >
            <span className="inline-flex items-center gap-1.5">
              <Search size={15} className="shrink-0 text-icon" aria-hidden />
              <span className="hidden sm:inline">搜索</span>
            </span>
            <kbd className="docs-kbd hidden md:inline-flex" aria-hidden>
              /
            </kbd>
          </Button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-icon no-underline hover:bg-mist hover:text-ink"
            aria-label="GitHub 仓库"
          >
            <Github size={16} />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
export default SiteHeader;
