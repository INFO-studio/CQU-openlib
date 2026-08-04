import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminError } from '~/admin/AdminShell';
import {
  type FormType,
  fetchSubmissions,
  type SubmissionItem,
} from '~/admin/lib/api';
import type { SubmissionStatus } from '~/admin/lib/status';
import { FilterRail } from '~/admin/modules/submissions/FilterRail';
import { submissionSearchText } from '~/admin/modules/submissions/labels';
import { SubmissionRow } from '~/admin/modules/submissions/SubmissionRow';
import { ActivitySpinner } from '~/components/ui/activity-spinner';

type Props = {
  /** Bumps when shell unlocks / reloads. */
  refreshToken: number;
  onUnauthorized: () => void;
};

const tally = <T extends string>(
  items: SubmissionItem[],
  pick: (item: SubmissionItem) => T,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = pick(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
};

/**
 * The whole set is fetched once and filtered in the browser: the collection is
 * small, and it keeps the rail's counts honest — each facet tallies under the
 * other facets rather than under itself.
 */
export const SubmissionsPage = ({ refreshToken, onUnauthorized }: Props) => {
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [type, setType] = useState<'' | FormType>('');
  const [status, setStatus] = useState<'' | SubmissionStatus>('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchSubmissions();
    if (!res.success) {
      if (res.message === 'unauthorized') onUnauthorized();
      else setError(res.message || '加载失败');
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(res.items ?? []);
    setLoading(false);
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => submissionSearchText(item).includes(q));
  }, [items, query]);

  const typeCounts = useMemo(
    () =>
      tally(
        searched.filter((item) => !status || item.status === status),
        (item) => item.type,
      ),
    [searched, status],
  );

  const statusCounts = useMemo(
    () =>
      tally(
        searched.filter((item) => !type || item.type === type),
        (item) => item.status,
      ),
    [searched, type],
  );

  const visible = useMemo(
    () =>
      searched.filter(
        (item) =>
          (!type || item.type === type) && (!status || item.status === status),
      ),
    [searched, type, status],
  );

  const patchItem = useCallback((next: SubmissionItem) => {
    setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));
  }, []);

  const onReset = useCallback(() => {
    setQuery('');
    setType('');
    setStatus('');
  }, []);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
      <section className="min-w-0" aria-label="表单收集">
        <header className="mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-3.5">
          <div>
            <h1 className="m-0 font-display text-2xl font-semibold">
              表单收集
            </h1>
            <p className="m-0 mt-1 font-mono text-[0.74rem] tabular-nums tracking-wide text-icon">
              {visible.length === items.length
                ? `${items.length} 条`
                : `${visible.length} / ${items.length} 条`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-2 text-[0.82rem] text-muted transition-colors hover:bg-mist hover:text-ink disabled:cursor-progress disabled:opacity-50"
          >
            <RefreshCw size={13} className="text-icon" aria-hidden />
            刷新
          </button>
        </header>

        {error ? <AdminError>{error}</AdminError> : null}

        {loading ? (
          <div className="grid min-h-48 place-items-center text-icon" aria-busy>
            <ActivitySpinner size={28} label="加载中" />
          </div>
        ) : visible.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-line px-4 py-12 text-center text-[0.88rem] text-icon">
            {items.length === 0
              ? '还没有提交记录'
              : '没有符合当前筛选的记录，换个条件试试'}
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {visible.map((item) => (
              <SubmissionRow
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() =>
                  setOpenId((prev) => (prev === item.id ? null : item.id))
                }
                onUpdated={patchItem}
                onUnauthorized={onUnauthorized}
              />
            ))}
          </ul>
        )}
      </section>

      <FilterRail
        query={query}
        onQueryChange={setQuery}
        type={type}
        onTypeChange={setType}
        typeCounts={typeCounts}
        status={status}
        onStatusChange={setStatus}
        statusCounts={statusCounts}
        total={searched.length}
        onReset={onReset}
      />
    </div>
  );
};
