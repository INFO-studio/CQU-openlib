import { Dialog } from '@base-ui/react/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import DocLink from '~/components/DocLink';
import { SearchSkeleton } from '~/components/Skeleton';
import { useDeferredFlag } from '~/hooks/useDeferredFlag';
import { cn } from '~/lib/cn';
import type { SearchChunkMeta, SearchEntry } from '~/lib/nav';
import { toNavTarget } from '~/lib/paths';
import { entryMatches, sortMatches } from '~/lib/searchMatch';
import { searchChunkQueryOptions } from '~/queries/search';

type Props = {
  chunks: SearchChunkMeta[];
  open: boolean;
  onClose: () => void;
};

const PAGE_SIZE = 36;

const highlightMatch = (text: string, query: string): ReactNode => {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let idx = lower.indexOf(needle, start);
  let key = 0;
  while (idx !== -1) {
    if (idx > start) parts.push(text.slice(start, idx));
    parts.push(
      <mark
        key={key++}
        className="rounded-[0.15em] bg-primary-soft px-[0.1em] text-inherit"
      >
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    start = idx + needle.length;
    idx = lower.indexOf(needle, start);
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts.length ? parts : text;
};

const SearchDialog = ({ chunks, open, onClose }: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [matched, setMatched] = useState<SearchEntry[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [nextChunk, setNextChunk] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const runId = useRef(0);
  const matchedRef = useRef<SearchEntry[]>([]);
  const nextChunkRef = useRef(0);
  const loadingRef = useRef(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const visible = hasQuery ? matched.slice(0, visibleCount) : [];
  const hasMoreVisible = hasQuery && visibleCount < matched.length;
  const hasMoreChunks = hasQuery && nextChunk < chunks.length;
  const canLoadMore = hasMoreVisible || hasMoreChunks;

  const pumpTo = useCallback(
    async (want: number) => {
      if (loadingRef.current) return;
      const id = runId.current;
      loadingRef.current = true;
      setLoading(true);

      let cursor = nextChunkRef.current;
      let acc = matchedRef.current;

      while (acc.length < want && cursor < chunks.length) {
        if (runId.current !== id) {
          loadingRef.current = false;
          return;
        }
        const meta = chunks[cursor]!;
        setStatus(`加载 ${meta.label}…`);
        try {
          const entries = await queryClient.fetchQuery(
            searchChunkQueryOptions(meta),
          );
          if (runId.current !== id) {
            loadingRef.current = false;
            return;
          }
          const hits = entries.filter((e) => entryMatches(e, queryRef.current));
          acc = sortMatches([...acc, ...hits], queryRef.current);
          matchedRef.current = acc;
          setMatched(acc);
        } catch {
          // skip broken chunk
        }
        cursor += 1;
        nextChunkRef.current = cursor;
        setNextChunk(cursor);
      }

      if (runId.current !== id) {
        loadingRef.current = false;
        return;
      }
      loadingRef.current = false;
      setLoading(false);
      setStatus(
        cursor >= chunks.length ? (acc.length ? '' : '没有匹配的目录项') : '',
      );
    },
    [chunks, queryClient],
  );

  const loadMore = useCallback(() => {
    if (!hasQuery) return;
    if (hasMoreVisible) {
      setVisibleCount((n) => n + PAGE_SIZE);
      return;
    }
    if (!hasMoreChunks || loadingRef.current) return;
    const want = matchedRef.current.length + PAGE_SIZE;
    setVisibleCount(want);
    void pumpTo(want);
  }, [hasQuery, hasMoreVisible, hasMoreChunks, pumpTo]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    runId.current += 1;
    matchedRef.current = [];
    nextChunkRef.current = 0;
    loadingRef.current = false;
    setMatched([]);
    setVisibleCount(PAGE_SIZE);
    setNextChunk(0);
    setActiveIndex(0);
    setLoading(false);
    setStatus('');

    if (!query.trim()) return;
    if (!chunks.length) {
      setStatus('索引未就绪');
      return;
    }
    void pumpTo(PAGE_SIZE);
  }, [open, query, chunks, pumpTo]);

  useEffect(() => {
    setActiveIndex((i) =>
      visible.length === 0 ? 0 : Math.min(i, visible.length - 1),
    );
  }, [visible.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || visible.length === 0) return;
    list
      .querySelector<HTMLElement>(`[data-search-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, visible.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !open || !hasQuery) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        loadMore();
      },
      { root, rootMargin: '80px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [open, hasQuery, loadMore, visible.length, loading]);

  const goTo = (path: string) => {
    onClose();
    const target = toNavTarget(path);
    if (target.to === '/') {
      void navigate({ to: '/' });
    } else {
      void navigate({ to: '/$', params: target.params });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!visible.length) return;
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
      if (activeIndex >= visible.length - 3 && canLoadMore) loadMore();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!visible.length) return;
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = visible[activeIndex];
      if (item) goTo(item.path);
    }
  };

  const waitingFirstPage = hasQuery && loading && visible.length === 0;
  const showSkeleton = useDeferredFlag(waitingFirstPage);
  const showEmpty =
    hasQuery && !loading && visible.length === 0 && Boolean(status);
  /** Hide results chrome until skeleton delay elapses or we have something to show. */
  const showPanel =
    hasQuery && (showSkeleton || showEmpty || visible.length > 0);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--c-backdrop)]" />
        <Dialog.Popup
          className="fixed top-[10vh] left-1/2 z-51 w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[0.65rem] border border-line bg-elev shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          aria-label="目录搜索"
        >
          <div
            className={cn(
              'flex items-center gap-2 px-3',
              showPanel ? 'border-b border-line' : undefined,
            )}
          >
            <Search size={16} className="shrink-0 text-icon" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="搜索标题或课程代码…"
              className="h-11 flex-1 border-none bg-transparent text-sm shadow-none outline-none! placeholder:text-muted focus:border-none focus:shadow-none focus:outline-none! focus-visible:outline-none!"
              aria-autocomplete="list"
              aria-controls="docs-search-results"
              aria-activedescendant={
                visible[activeIndex]
                  ? `docs-search-item-${activeIndex}`
                  : undefined
              }
            />
            <Dialog.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded text-icon hover:bg-mist hover:text-ink"
              aria-label="关闭"
            >
              <X size={16} />
            </Dialog.Close>
          </div>
          {showPanel ? (
            <div
              ref={listRef}
              id="docs-search-results"
              className="max-h-[min(50vh,24rem)] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {showSkeleton ? (
                <SearchSkeleton />
              ) : showEmpty ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  {status}
                </p>
              ) : (
                <ul role="listbox" className="p-1.5">
                  {visible.map((item, index) => {
                    const active = index === activeIndex;
                    return (
                      <li
                        key={`${item.path}-${index}`}
                        id={`docs-search-item-${index}`}
                        role="option"
                        aria-selected={active}
                        data-search-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <DocLink
                          path={item.path}
                          className={cn(
                            'group flex items-baseline justify-between gap-3 rounded-md px-2.5 py-2 no-underline transition-colors',
                            active
                              ? 'bg-primary-soft text-ink'
                              : 'hover:bg-mist',
                          )}
                          onNavigate={onClose}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink">
                              {highlightMatch(item.title, query)}
                            </span>
                            {item.codes?.length ? (
                              <span className="mt-0.5 block truncate font-mono text-[0.7rem] text-muted">
                                {highlightMatch(item.codes.join(' · '), query)}
                              </span>
                            ) : (
                              <span className="mt-0.5 block truncate text-[0.7rem] text-muted">
                                {highlightMatch(item.path, query)}
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 text-[0.65rem]',
                              active
                                ? 'text-icon'
                                : 'text-muted group-hover:text-icon',
                            )}
                          >
                            {item.sectionLabel}
                          </span>
                        </DocLink>
                      </li>
                    );
                  })}
                  <li
                    ref={sentinelRef}
                    className="px-3 py-2 text-center text-[0.7rem] text-muted"
                    aria-hidden
                  >
                    {loading
                      ? status || '加载中…'
                      : canLoadMore
                        ? ''
                        : matched.length
                          ? `共 ${matched.length} 条`
                          : null}
                  </li>
                </ul>
              )}
            </div>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
export default SearchDialog;
