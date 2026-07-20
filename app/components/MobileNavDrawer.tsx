import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import CourseSidebar from '~/components/CourseSidebar';
import DocLink from '~/components/DocLink';
import NavLoadError from '~/components/NavLoadError';
import Sidebar from '~/components/Sidebar';
import { NavSkeleton } from '~/components/Skeleton';
import { useDeferredFlag } from '~/hooks/useDeferredFlag';
import { cn } from '~/lib/cn';
import {
  type DocNavIndex,
  NAV_SECTIONS,
  NAV_SECTIONS_VISIBLE,
  sectionForPath,
} from '~/lib/nav';

type Props = {
  open: boolean;
  onClose: () => void;
  pathname: string;
  index: DocNavIndex | null;
  navLoading?: boolean;
  navError?: string | null;
  onRetryNav?: () => void;
};

const HScrollTabs = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [value]);

  return (
    <div className="relative border-b border-line">
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-panel to-transparent transition-opacity',
          canLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={ref}
        role="tablist"
        aria-label="站点大类"
        className="flex gap-0 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {NAV_SECTIONS_VISIBLE.map((section) => {
          const active = section.id === value;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active || undefined}
              onClick={() => onChange(section.id)}
              className={cn(
                'relative shrink-0 px-3 py-2.5 text-[0.8125rem] transition-colors',
                active ? 'font-medium text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {section.label}
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-full',
                  active ? 'bg-primary' : 'bg-transparent',
                )}
              />
            </button>
          );
        })}
      </div>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-panel to-transparent transition-opacity',
          canRight ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
};

const MobileNavDrawer = ({
  open,
  onClose,
  pathname,
  index,
  navLoading = false,
  navError = null,
  onRetryNav,
}: Props) => {
  const routeSection = useMemo(() => sectionForPath(pathname), [pathname]);
  const defaultBrowseId = NAV_SECTIONS_VISIBLE[0]!.id;
  const [browseId, setBrowseId] = useState(() =>
    routeSection && !routeSection.hiddenInNav
      ? routeSection.id
      : defaultBrowseId,
  );

  useEffect(() => {
    if (!open) return;
    setBrowseId(
      routeSection && !routeSection.hiddenInNav
        ? routeSection.id
        : defaultBrowseId,
    );
  }, [open, routeSection, defaultBrowseId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const browseSection =
    NAV_SECTIONS.find((s) => s.id === browseId) ?? NAV_SECTIONS[0]!;
  const browseData = index?.sections.find((s) => s.id === browseSection.id);
  const isCourse = browseSection.id === 'course';
  const showNavSkeleton = useDeferredFlag(navLoading);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 lg:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="站点目录"
        className={cn(
          'absolute inset-0 flex flex-col bg-panel/95 backdrop-blur-2xl transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        <header className="flex h-[var(--header-h)] shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            目录
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-icon hover:bg-mist hover:text-ink"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </header>

        <div className="shrink-0">
          <HScrollTabs value={browseId} onChange={setBrowseId} />
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 px-4 py-3',
            isCourse ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
          )}
        >
          {navLoading ? (
            showNavSkeleton ? (
              <NavSkeleton course={isCourse} />
            ) : null
          ) : navError ? (
            <NavLoadError message={navError} onRetry={() => onRetryNav?.()} />
          ) : browseData && browseData.tree.length > 0 ? (
            isCourse ? (
              <CourseSidebar
                tree={browseData.tree}
                currentPath={pathname}
                onNavigate={onClose}
                fadeFrom="var(--c-panel)"
              />
            ) : (
              <Sidebar
                title={browseSection.label}
                sectionPath={browseSection.path}
                tree={browseData.tree}
                currentPath={pathname}
                onNavigate={onClose}
              />
            )
          ) : (
            <div className="flex flex-col items-start gap-3 pt-2">
              <p className="text-sm text-muted">此分类暂无子目录</p>
              <DocLink
                path={browseSection.path}
                onNavigate={onClose}
                className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-ink no-underline"
              >
                打开「{browseSection.label}」
              </DocLink>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default MobileNavDrawer;
