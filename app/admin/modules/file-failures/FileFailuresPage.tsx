import { Activity, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminError } from '~/admin/AdminShell';
import {
  type FileFailureItem,
  type FileFailureKey,
  type FileFailureSummary,
  fetchFileFailures,
} from '~/admin/lib/fileFailures';
import { formatShanghaiShort } from '~/admin/lib/time';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import { cn } from '~/lib/cn';

type Props = {
  refreshToken: number;
  onUnauthorized: () => void;
};

const EMPTY_SUMMARY: FileFailureSummary = {
  site24h: 0,
  total30d: 0,
  affectedKeys30d: 0,
  alertThreshold: 10,
};

const ACTION =
  'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-[0.8rem] text-muted transition-colors hover:bg-mist hover:text-ink disabled:cursor-progress disabled:opacity-50';

const Summary = ({ data }: { data: FileFailureSummary }) => {
  const stats = [
    { label: '24H 全站', value: data.site24h },
    { label: '30D 失败', value: data.total30d },
    { label: '30D KEY', value: data.affectedKeys30d },
  ];
  return (
    <dl className="m-0 grid grid-cols-3 divide-x divide-line border-y border-line">
      {stats.map((stat) => (
        <div key={stat.label} className="px-3 py-3 first:pl-0 last:pr-0">
          <dt className="font-mono text-[0.66rem] tracking-[0.1em] text-icon">
            {stat.label}
          </dt>
          <dd
            className={cn(
              'm-0 mt-1 font-mono text-2xl tabular-nums',
              stat.value > data.alertThreshold ? 'text-error' : 'text-ink',
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const KeyList = ({
  items,
  threshold,
}: {
  items: FileFailureKey[];
  threshold: number;
}) => (
  <section aria-labelledby="failure-keys">
    <header className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
      <h2 id="failure-keys" className="m-0 text-base font-semibold">
        30 日内按 key
      </h2>
      <span className="font-mono text-[0.7rem] text-icon">
        阈值 &gt; {threshold}
      </span>
    </header>
    {items.length === 0 ? (
      <p className="m-0 rounded-xl border border-dashed border-line px-4 py-10 text-center text-[0.86rem] text-icon">
        30 日内没有解析失败
      </p>
    ) : (
      <ol className="m-0 list-none divide-y divide-line p-0">
        {items.map((item) => (
          <li
            key={item.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2.5"
          >
            <div className="min-w-0">
              <code className="block truncate text-[0.82rem] text-ink">
                {item.key}
              </code>
              <time className="mt-0.5 block text-[0.7rem] text-icon">
                最近 {formatShanghaiShort(item.lastAt)}
              </time>
            </div>
            <span
              className={cn(
                'font-mono text-lg tabular-nums',
                item.count > threshold ? 'text-error' : 'text-ink',
              )}
            >
              {item.count}
            </span>
          </li>
        ))}
      </ol>
    )}
  </section>
);

const FailureLog = ({ items }: { items: FileFailureItem[] }) => (
  <section aria-labelledby="failure-log">
    <header className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
      <h2 id="failure-log" className="m-0 text-base font-semibold">
        最近失败
      </h2>
      <span className="font-mono text-[0.7rem] text-icon">最多 200 条</span>
    </header>
    {items.length === 0 ? (
      <p className="m-0 rounded-xl border border-dashed border-line px-4 py-10 text-center text-[0.86rem] text-icon">
        还没有失败记录
      </p>
    ) : (
      <ul className="m-0 list-none divide-y divide-line p-0">
        {items.map((item) => (
          <li key={item.id} className="py-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <code className="min-w-0 truncate text-[0.8rem] text-ink">
                {item.key}
              </code>
              <time className="shrink-0 font-mono text-[0.68rem] text-icon">
                {formatShanghaiShort(item.at)}
              </time>
            </div>
            <p className="m-0 mt-1 break-words font-mono text-[0.72rem] leading-relaxed text-muted">
              {item.reason}
            </p>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const FileFailuresPage = ({ refreshToken, onUnauthorized }: Props) => {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [keys, setKeys] = useState<FileFailureKey[]>([]);
  const [items, setItems] = useState<FileFailureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchFileFailures();
    if (!result.success) {
      if (result.message === 'unauthorized') onUnauthorized();
      else setError(result.message || '加载失败');
      setLoading(false);
      return;
    }
    setSummary(result.summary ?? EMPTY_SUMMARY);
    setKeys(result.keys ?? []);
    setItems(result.items ?? []);
    setLoading(false);
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-icon-strong" aria-hidden />
            <h1 className="m-0 font-display text-2xl font-semibold">
              直链解析监控
            </h1>
          </div>
          <p className="m-0 mt-1.5 text-[0.82rem] text-muted">
            全站 24 小时与单 key 30 日窗口
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={ACTION}
        >
          <RefreshCw size={13} className="text-icon" aria-hidden />
          刷新
        </button>
      </header>

      {error ? <AdminError>{error}</AdminError> : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center text-icon" aria-busy>
          <ActivitySpinner size={28} label="加载中" />
        </div>
      ) : (
        <>
          <Summary data={summary} />
          {summary.site24h > summary.alertThreshold ? (
            <p className="my-5 flex items-center gap-2 rounded-lg bg-error-soft px-3 py-2 text-[0.82rem] text-error">
              <TriangleAlert size={15} className="text-error" aria-hidden />
              全站 24 小时失败已超过告警阈值
            </p>
          ) : null}
          <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(22rem,1.2fr)]">
            <KeyList items={keys} threshold={summary.alertThreshold} />
            <FailureLog items={items} />
          </div>
        </>
      )}
    </div>
  );
};
