import { Dialog } from '@base-ui/react/dialog';
import { useNavigate } from '@tanstack/react-router';
import parse from 'html-react-parser';
import { Search, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import DocLink from '~/components/DocLink';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import { SearchSkeleton } from '~/components/ui/skeleton';
import { useDeferredFlag } from '~/hooks/useDeferredFlag';
import { cn } from '~/lib/cn';
import { toNavTarget } from '~/lib/paths';
import {
  loadSearchResults,
  type SearchHit,
  type SearchResult,
  searchDocuments,
} from '~/lib/searchMatch';
import { findExactCourseCodes, getSearchEngine } from '~/queries/search';

type Props = { open: boolean; onClose: () => void };
const pageSize = 10;

const SearchDialog = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [composing, setComposing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);
  const loadingMore = useRef(false);
  const hasQuery = Boolean(query.trim());
  const canLoadMore = results.length < hits.length;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setComposing(false);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const id = ++runId.current;
    setResults([]);
    setHits([]);
    setActiveIndex(0);
    setError('');
    setLoading(false);
    loadingMore.current = false;
    if (!open || !query.trim() || composing) return;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const exact = await findExactCourseCodes(query);
        if (id !== runId.current) return;
        if (exact.length) {
          setHits([]);
          setResults(
            exact.map((entry) => ({
              id: `code:${entry.path}`,
              path: entry.path,
              title: entry.title,
              section: entry.section,
              codes: entry.codes.join(' '),
              excerpt: '',
              exact: true,
            })),
          );
          return;
        }
        const engine = await getSearchEngine();
        if (id !== runId.current) return;
        const next = await searchDocuments(engine, query);
        if (id !== runId.current) return;
        const first = await loadSearchResults(next.slice(0, pageSize));
        if (id !== runId.current) return;
        setHits(next);
        setResults(first);
      } catch {
        if (id === runId.current) setError('搜索加载失败，请重试');
      } finally {
        if (id === runId.current) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      runId.current += 1;
    };
  }, [open, query, composing, retry]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-search-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const loadMore = async () => {
    if (loading || loadingMore.current || !canLoadMore) return;
    loadingMore.current = true;
    setLoading(true);
    setError('');
    const id = runId.current;
    try {
      const more = await loadSearchResults(
        hits.slice(results.length, results.length + pageSize),
      );
      if (id === runId.current)
        setResults((previous) => [...previous, ...more]);
    } catch {
      if (id === runId.current) setError('搜索加载失败，请重试');
    } finally {
      if (id === runId.current) {
        loadingMore.current = false;
        setLoading(false);
      }
    }
  };

  const goTo = (path: string) => {
    onClose();
    const target = toNavTarget(path);
    if (target.to === '/') void navigate({ to: '/', hash: target.hash });
    else if (target.to === '/map')
      void navigate({ to: '/map', search: target.search, hash: target.hash });
    else if (target.to === '/academic/graduation')
      void navigate({
        to: '/academic/graduation',
        search: target.search,
        hash: target.hash,
      });
    else void navigate({ to: '/$', params: target.params, hash: target.hash });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || composing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
      if (activeIndex === results.length - 1) void loadMore();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      goTo(results[activeIndex].path);
    }
  };

  const showSkeleton = useDeferredFlag(hasQuery && loading && !results.length);
  const showPanel =
    hasQuery && !composing && (showSkeleton || !loading || results.length > 0);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-backdrop" />
        <Dialog.Popup
          className="fixed top-[10vh] left-1/2 z-51 w-[min(38rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[0.65rem] border border-line bg-elev shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          aria-label="全文搜索"
        >
          <div
            className={cn(
              'flex items-center gap-2 px-3',
              showPanel && 'border-b border-line',
            )}
          >
            <Search size={16} className="shrink-0 text-icon" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                runId.current += 1;
                setQuery(event.target.value);
              }}
              onCompositionStart={() => {
                runId.current += 1;
                setComposing(true);
              }}
              onCompositionEnd={(event) => {
                setComposing(false);
                setQuery(event.currentTarget.value);
              }}
              onKeyDown={onKeyDown}
              placeholder="搜索内容、课程号或关键词…"
              aria-label="搜索内容、课程号或关键词"
              className="h-11 min-w-0 flex-1 border-none bg-transparent text-sm shadow-none outline-none! placeholder:text-muted focus:border-none focus:shadow-none focus:outline-none! focus-visible:outline-none!"
              role="combobox"
              aria-expanded={Boolean(showPanel)}
              aria-autocomplete="list"
              aria-controls="docs-search-results"
              aria-activedescendant={
                results[activeIndex]
                  ? `docs-search-item-${activeIndex}`
                  : undefined
              }
            />
            <Dialog.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded text-icon hover:bg-mist hover:text-icon-strong"
              aria-label="关闭"
            >
              <X size={16} />
            </Dialog.Close>
          </div>
          {showPanel ? (
            <div
              ref={listRef}
              className="max-h-[min(60vh,32rem)] overflow-y-auto"
            >
              {showSkeleton ? (
                <SearchSkeleton />
              ) : (
                <>
                  <ul
                    id="docs-search-results"
                    role="listbox"
                    aria-label="搜索结果"
                    className="p-1.5"
                  >
                    {results.map((item, index) => (
                      <li
                        key={item.id}
                        id={`docs-search-item-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        data-search-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <DocLink
                          path={item.path}
                          onNavigate={onClose}
                          className={cn(
                            'block rounded-md px-2.5 py-2.5 no-underline transition-colors',
                            index === activeIndex
                              ? 'bg-primary-soft text-ink'
                              : 'hover:bg-mist',
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm font-medium text-ink">
                              {item.title}
                            </span>
                            {item.exact ? (
                              <span className="shrink-0 text-[0.65rem] text-primary">
                                课程号匹配
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-[0.7rem] text-muted">
                            {item.section}
                            {item.codes ? ` · ${item.codes}` : ''}
                          </span>
                          {item.excerpt ? (
                            <span className="mt-1 block text-xs leading-relaxed text-muted [&_mark]:rounded-[0.15em] [&_mark]:bg-primary-soft [&_mark]:text-ink">
                              {parse(item.excerpt)}
                            </span>
                          ) : null}
                        </DocLink>
                      </li>
                    ))}
                  </ul>
                  {error ? (
                    <div
                      role="alert"
                      className="px-3 py-4 text-center text-sm text-muted"
                    >
                      {error}
                      <button
                        type="button"
                        className="ml-2 text-primary hover:underline"
                        onClick={() =>
                          results.length
                            ? void loadMore()
                            : setRetry((n) => n + 1)
                        }
                      >
                        重试
                      </button>
                    </div>
                  ) : !results.length && !loading ? (
                    <p
                      role="status"
                      className="px-3 pb-6 text-center text-sm text-muted"
                    >
                      没有匹配的内容
                    </p>
                  ) : null}
                  {loading ? (
                    <div className="flex justify-center p-3">
                      <ActivitySpinner
                        size={16}
                        className="text-icon"
                        label="加载中"
                      />
                    </div>
                  ) : canLoadMore ? (
                    <button
                      type="button"
                      className="w-full border-t border-line px-3 py-3 text-xs text-primary hover:bg-mist"
                      onClick={() => void loadMore()}
                    >
                      加载更多结果
                    </button>
                  ) : results.length ? (
                    <p
                      role="status"
                      className="px-3 pb-3 text-center text-[0.7rem] text-muted"
                    >
                      共 {hits.length || results.length} 条结果
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
export default SearchDialog;
