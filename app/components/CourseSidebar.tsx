import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import {
  type MutableRefObject,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import DocLink from '~/components/DocLink';
import { cn } from '~/lib/cn';
import {
  ALPHA_LETTERS,
  type AlphaLetter,
  groupCoursesByAlpha,
  letterOfTitle,
} from '~/lib/courseAlpha';
import type { SidebarNode } from '~/lib/nav';
import { decodePathname } from '~/lib/paths';
import { useSidebarStore } from '~/stores/sidebarStore';

type Props = {
  tree: SidebarNode[];
  currentPath: string;
  onNavigate?: () => void;
  /** Scroll fade color — match the surface behind the list (paper / panel). */
  fadeFrom?: string;
};

const LETTER_TOP_PAD = 10;

const ScrollMask = ({
  children,
  className,
  listClassName,
  centerPath,
  listRef: listRefProp,
  fadeFrom = 'var(--c-paper)',
}: {
  children: ReactNode;
  className?: string;
  listClassName?: string;
  /** When set, scroll this course path to the vertical center of the list. */
  centerPath?: string | null;
  listRef?: Ref<HTMLUListElement | null>;
  fadeFrom?: string;
}) => {
  const ref = useRef<HTMLUListElement>(null);
  const setListRef = (node: HTMLUListElement | null) => {
    ref.current = node;
    if (typeof listRefProp === 'function') listRefProp(node);
    else if (listRefProp) {
      (listRefProp as MutableRefObject<HTMLUListElement | null>).current = node;
    }
  };
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setCanUp(scrollTop > 2);
      setCanDown(scrollTop + clientHeight < scrollHeight - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !centerPath) return;

    let cancelled = false;
    let attempts = 0;

    const scrollActiveToCenter = () => {
      if (cancelled) return;
      const active = el.querySelector<HTMLElement>(
        `[data-course-path="${CSS.escape(centerPath)}"]`,
      );
      if (!active) {
        if (attempts++ < 8) {
          window.requestAnimationFrame(scrollActiveToCenter);
        }
        return;
      }

      const delta =
        active.getBoundingClientRect().top -
        el.getBoundingClientRect().top -
        el.clientHeight / 2 +
        active.offsetHeight / 2;
      el.scrollTo({
        top: Math.max(0, el.scrollTop + delta),
        behavior: 'smooth',
      });
    };

    const frame = window.requestAnimationFrame(scrollActiveToCenter);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [centerPath]);

  return (
    <div className={cn('relative min-h-0', className)}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 h-6 transition-opacity duration-200',
          canUp ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          background: `linear-gradient(to bottom, ${fadeFrom}, transparent)`,
        }}
      />
      <ul ref={setListRef} className={listClassName}>
        {children}
      </ul>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 transition-opacity duration-200',
          canDown ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          background: `linear-gradient(to top, ${fadeFrom}, transparent)`,
        }}
      />
    </div>
  );
};

const formatCodes = (codes?: string[]) => {
  if (!codes?.length) return null;
  if (codes.length <= 2) return codes.join(' · ');
  return `${codes.slice(0, 2).join(' · ')} +${codes.length - 2}`;
};

const CourseSidebar = ({
  tree,
  currentPath,
  onNavigate,
  fadeFrom = 'var(--c-paper)',
}: Props) => {
  const groups = useMemo(() => groupCoursesByAlpha(tree), [tree]);
  const { ensureAncestorsOpen, isExpanded, setOpen } = useSidebarStore();
  const [activeLetter, setActiveLetter] = useState<AlphaLetter | null>(null);
  const groupsListRef = useRef<HTMLUListElement | null>(null);

  const scrollLetterToTop = useCallback((letter: AlphaLetter) => {
    const list = groupsListRef.current;
    const target = document.getElementById(`course-alpha-${letter}`);
    if (!list || !target) return;
    const top =
      target.getBoundingClientRect().top -
      list.getBoundingClientRect().top +
      list.scrollTop -
      LETTER_TOP_PAD;
    list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);

  const jumpToLetter = useCallback(
    (letter: AlphaLetter) => {
      setOpen(`course-alpha:${letter}`, true);
      setActiveLetter(letter);
      window.requestAnimationFrame(() => scrollLetterToTop(letter));
    },
    [scrollLetterToTop, setOpen],
  );

  const coursePath = useMemo(() => {
    if (currentPath === '/course' || !currentPath.startsWith('/course/')) {
      return null;
    }
    return decodePathname(currentPath);
  }, [currentPath]);

  const activeCourse = useMemo(() => {
    if (!coursePath) return null;
    for (const group of groups) {
      const hit = group.items.find(
        (item) => item.path === coursePath || item.path === currentPath,
      );
      if (hit) return hit;
    }
    return null;
  }, [groups, coursePath, currentPath]);

  useEffect(() => {
    ensureAncestorsOpen(currentPath);
    if (!activeCourse) {
      setActiveLetter(null);
      return;
    }
    const letter = letterOfTitle(activeCourse.title);
    setOpen(`course-alpha:${letter}`, true);
    setActiveLetter(letter);
    window.requestAnimationFrame(() => scrollLetterToTop(letter));
  }, [
    currentPath,
    activeCourse,
    ensureAncestorsOpen,
    scrollLetterToTop,
    setOpen,
  ]);

  const present = useMemo(() => new Set(groups.map((g) => g.letter)), [groups]);

  return (
    <nav
      aria-label="课程目录 A–Z"
      className="docs-nav flex h-full min-h-0 flex-col gap-2"
    >
      <div className="shrink-0 space-y-2">
        <DocLink
          path="/course"
          onNavigate={onNavigate}
          className="text-sm font-semibold text-ink no-underline hover:text-primary"
        >
          课程
        </DocLink>

        <div
          className="rounded-md bg-mist/80 p-1.5"
          role="navigation"
          aria-label="字母快速跳转"
        >
          <div className="grid grid-cols-9 gap-0.5">
            {ALPHA_LETTERS.map((letter) => {
              const enabled = present.has(letter);
              const active = activeLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!enabled}
                  className={cn(
                    'h-6 rounded text-[0.65rem] font-mono font-semibold transition-colors',
                    active
                      ? 'bg-primary text-paper'
                      : enabled
                        ? 'text-muted hover:bg-panel hover:text-ink'
                        : 'cursor-default text-muted/25',
                  )}
                  onClick={() => {
                    if (!enabled) return;
                    jumpToLetter(letter);
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ScrollMask
        className="min-h-0 flex-1"
        listClassName="flex h-full flex-col gap-0.5 overflow-y-auto pr-0.5"
        centerPath={null}
        listRef={groupsListRef}
        fadeFrom={fadeFrom}
      >
        {groups.map((group) => {
          const key = `course-alpha:${group.letter}`;
          const open = isExpanded(key);
          const active = activeLetter === group.letter;
          return (
            <li key={group.letter} id={`course-alpha-${group.letter}`}>
              <Collapsible.Root
                open={open}
                onOpenChange={(next) => {
                  setOpen(key, next);
                  if (next) setActiveLetter(group.letter);
                }}
              >
                <div
                  className={cn(
                    'grid w-full grid-cols-[1.25rem_auto_1fr] items-center gap-1 rounded px-1 py-0.5 text-[0.8125rem]',
                    active || open ? 'bg-primary-soft text-ink' : undefined,
                  )}
                >
                  <Collapsible.Trigger
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-icon hover:bg-mist hover:text-ink"
                    aria-label={open ? '折叠' : '展开'}
                  >
                    <ChevronRight
                      size={14}
                      className={cn(
                        'transition-transform duration-150',
                        open ? 'rotate-90' : undefined,
                      )}
                    />
                  </Collapsible.Trigger>
                  <button
                    type="button"
                    className="font-mono text-xs font-semibold hover:text-primary"
                    onClick={() => {
                      setOpen(key, true);
                      setActiveLetter(group.letter);
                    }}
                  >
                    {group.letter}
                  </button>
                  <span className="text-[0.7rem] text-muted">
                    {group.items.length}
                  </span>
                </div>
                <Collapsible.Panel>
                  <ScrollMask
                    className="ml-3 mt-0.5"
                    listClassName="max-h-56 overflow-y-auto border-l border-line pl-2"
                    centerPath={active && coursePath ? coursePath : null}
                    fadeFrom={fadeFrom}
                  >
                    {group.items.map((item) => {
                      const itemActive = coursePath === item.path;
                      const codesLabel = formatCodes(item.codes);
                      return (
                        <li key={item.path} data-course-path={item.path}>
                          <DocLink
                            path={item.path}
                            onNavigate={onNavigate}
                            className={cn(
                              'block rounded px-1.5 py-0.5 no-underline',
                              itemActive
                                ? 'bg-primary-soft font-medium text-ink'
                                : 'text-muted hover:bg-mist hover:text-ink',
                            )}
                          >
                            <span className="block truncate text-[0.8125rem]">
                              {item.title}
                            </span>
                            {codesLabel ? (
                              <span className="block truncate font-mono text-[0.65rem] text-icon">
                                {codesLabel}
                              </span>
                            ) : null}
                          </DocLink>
                        </li>
                      );
                    })}
                  </ScrollMask>
                </Collapsible.Panel>
              </Collapsible.Root>
            </li>
          );
        })}
      </ScrollMask>
    </nav>
  );
};
export default CourseSidebar;
