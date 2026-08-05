import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AdminError } from '~/admin/AdminShell';
import {
  ANALYTICS_RANGES,
  type AnalyticsData,
  type AnalyticsRange,
  clickLabel,
  downloadKindLabel,
  EMPTY_ANALYTICS,
  errorReasonLabel,
  fetchAnalytics,
  mapAnalytics,
} from '~/admin/lib/analytics';
import { formatShanghaiShort } from '~/admin/lib/time';
import { OverviewCards } from '~/admin/modules/analytics/OverviewCards';
import { type RankRow, RankTable } from '~/admin/modules/analytics/RankTable';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import { Bone } from '~/components/ui/skeleton';
import { cn } from '~/lib/cn';

/**
 * recharts is ~100 KB of chart engine that only this one screen needs. The
 * route is already its own chunk, and this second boundary keeps it that way
 * even if the router's code-splitting config ever changes.
 */
const TrendChart = lazy(() => import('~/admin/modules/analytics/TrendChart'));

const PANEL_ROWS = 12;
const PAGE_ROWS = 20;

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="grid gap-2.5">
    <h2 className="m-0 text-[0.8rem] font-medium text-icon">{title}</h2>
    {/* `items-start` so a short panel stops stretching to its neighbour's height. */}
    <div className="grid items-start gap-4 xl:grid-cols-2">{children}</div>
  </section>
);

const LEGEND = [
  { label: '浏览量', className: 'border-t-2 border-primary' },
  { label: '会话数', className: 'border-t border-dashed border-icon' },
];

type Props = {
  /** Bumps when shell unlocks / reloads. */
  refreshToken: number;
  onUnauthorized: () => void;
};

export const AnalyticsPage = ({ refreshToken, onUnauthorized }: Props) => {
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [data, setData] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAnalytics(range);
    if (!res.success) {
      if (res.message === 'unauthorized') onUnauthorized();
      else setError(res.message || '加载失败');
      // Deliberately keeps the previous payload: a screen of zeros reads as
      // "no traffic", which is a different and wrong answer.
      setLoading(false);
      return;
    }
    setData(mapAnalytics(res, range));
    setLoaded(true);
    setLoading(false);
  }, [range, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const period =
    data.daily.length > 0
      ? `${data.daily[0]?.date} – ${data.daily.at(-1)?.date}`
      : '';
  const hasTraffic = data.daily.some((point) => point.views > 0);

  const topPages: RankRow[] = data.topPages.slice(0, PAGE_ROWS).map((row) => ({
    id: row.path,
    label: row.path,
    value: row.views,
    sub: `${row.sessions.toLocaleString('zh-CN')} 会话`,
  }));

  const allTime: RankRow[] = data.allTime.slice(0, PAGE_ROWS).map((row) => ({
    id: row.path,
    label: row.path,
    value: row.count,
    sub: row.lastAt ? `最近 ${formatShanghaiShort(row.lastAt)}` : undefined,
  }));

  const entryPages: RankRow[] = data.entryPages
    .slice(0, PANEL_ROWS)
    .map((row) => ({ id: row.path, label: row.path, value: row.count }));

  const downloads: RankRow[] = data.downloads
    .slice(0, PANEL_ROWS)
    .map((row) => ({
      id: row.ref,
      label: row.text || row.ref,
      value: row.count,
      sub: [downloadKindLabel(row.kind), row.page].filter(Boolean).join(' · '),
    }));

  const searches: RankRow[] = data.searches.slice(0, PANEL_ROWS).map((row) => ({
    id: row.query,
    label: row.query,
    value: row.count,
    sub: `${row.results} 条结果 · 打开 ${row.selected} 次`,
  }));

  const deadSearches: RankRow[] = data.deadSearches
    .slice(0, PANEL_ROWS)
    .map((row) => ({ id: row.query, label: row.query, value: row.count }));

  const clicks: RankRow[] = data.clicks.map((row) => ({
    id: row.itemType,
    label: clickLabel(row.itemType),
    value: row.count,
  }));

  const flows: RankRow[] = data.flows.slice(0, PANEL_ROWS).map((row) => ({
    id: `${row.from}→${row.to}`,
    label: row.to,
    value: row.count,
    sub: `来自 ${row.from}`,
  }));

  const errors: RankRow[] = data.errors.slice(0, PANEL_ROWS).map((row) => ({
    id: `${row.path}|${row.reason}`,
    label: row.path,
    value: row.count,
    sub: [
      errorReasonLabel(row.reason),
      row.from ? `来自 ${row.from}` : '直接进入',
    ].join(' · '),
  }));

  return (
    <section className="min-w-0" aria-label="访问统计">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3.5">
        <div>
          <h1 className="m-0 font-display text-2xl font-semibold">访问统计</h1>
          {period ? (
            <p className="m-0 mt-1 text-[0.78rem] tabular-nums text-icon">
              {period}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-line bg-panel p-0.5"
            role="group"
            aria-label="统计范围"
          >
            {ANALYTICS_RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                aria-pressed={range === option.id}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[0.82rem] transition-colors',
                  range === option.id
                    ? 'bg-primary-soft text-ink'
                    : 'text-muted hover:text-ink',
                )}
              >
                {option.label}
              </button>
            ))}
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
        </div>
      </header>

      {loading && !loaded ? (
        <div className="grid min-h-64 place-items-center text-icon" aria-busy>
          <ActivitySpinner size={28} label="加载中" />
        </div>
      ) : error && !loaded ? (
        <div className="grid min-h-64 place-items-center rounded-xl border border-line bg-panel px-4 py-12 text-center">
          <div>
            <p className="m-0 text-[0.95rem] text-ink">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="mt-4 rounded-md border border-line px-3.5 py-2 text-[0.84rem] text-muted transition-colors hover:bg-mist hover:text-ink disabled:cursor-progress disabled:opacity-50"
            >
              重新加载
            </button>
          </div>
        </div>
      ) : (
        <>
          {error ? (
            <div className="mb-4">
              <AdminError>{error}，下方为上次加载的数据</AdminError>
            </div>
          ) : null}

          <div className="grid gap-5">
            <OverviewCards overview={data.overview} />

            <section className="rounded-xl border border-line bg-panel p-4">
              <header className="mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-[0.95rem] font-semibold">每日趋势</h2>
                {hasTraffic ? (
                  <div className="flex items-center gap-3 text-[0.72rem] text-icon">
                    {LEGEND.map((item) => (
                      <span
                        key={item.label}
                        className="flex items-center gap-1.5"
                      >
                        <span
                          className={cn('w-3.5', item.className)}
                          aria-hidden
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </header>
              {hasTraffic ? (
                <Suspense fallback={<Bone className="h-[220px] w-full" />}>
                  <TrendChart data={data.daily} />
                </Suspense>
              ) : (
                <p className="m-0 py-10 text-center text-[0.82rem] text-icon">
                  该时间范围内没有访问
                </p>
              )}
            </section>

            <Group title="待处理">
              <RankTable
                title="无结果搜索"
                rows={deadSearches}
                empty="搜索均有结果"
              />
              <RankTable title="页面异常" rows={errors} empty="无异常" />
            </Group>

            <Group title="内容表现">
              <RankTable title="热门页面" rows={topPages} empty="暂无访问" />
              <RankTable
                title="全站累计进入"
                note="全时段"
                rows={allTime}
                empty="暂无累计数据"
              />
              <RankTable title="下载排行" rows={downloads} empty="暂无下载" />
              <RankTable title="交互类型" rows={clicks} empty="暂无交互" />
            </Group>

            <Group title="读者路径">
              <RankTable title="落地页" rows={entryPages} empty="暂无落地页" />
              <RankTable title="站内跳转" rows={flows} empty="暂无跳转" />
              <RankTable title="搜索词" rows={searches} empty="暂无搜索" />
            </Group>
          </div>
        </>
      )}
    </section>
  );
};
