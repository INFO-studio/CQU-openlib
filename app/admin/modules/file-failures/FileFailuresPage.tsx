import {
  Activity,
  Archive,
  Eraser,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminError } from '~/admin/AdminShell';
import {
  archiveFileFailures,
  type FileFailureArchive,
  type FileFailureItem,
  type FileFailureKey,
  type FileFailureSummary,
  fetchFileFailures,
  purgeFileFailureKey,
} from '~/admin/lib/fileFailures';
import { formatShanghaiShort } from '~/admin/lib/time';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/cn';

type Props = {
  refreshToken: number;
  onUnauthorized: () => void;
};

type Pending = 'archive' | 'purge' | null;

type KeyTally = { key: string; current: number; archive: number };

const EMPTY_SUMMARY: FileFailureSummary = {
  site24h: 0,
  total30d: 0,
  affectedKeys30d: 0,
  alertThreshold: 10,
};

const EMPTY_ARCHIVE: FileFailureArchive = { total: 0, keys: [] };

const SUGGESTION_LIMIT = 6;

const ACTION =
  'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-[0.8rem] text-muted transition-colors hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-50';

const ERROR_NOTE =
  'm-0 rounded-md bg-error-soft px-2.5 py-1.5 text-[0.78rem] text-error';

const countByKey = (rows: FileFailureKey[]) =>
  new Map(rows.map((row) => [row.key, row.count]));

const tallyKeys = (
  current: FileFailureKey[],
  archived: FileFailureKey[],
): KeyTally[] => {
  const live = countByKey(current);
  const old = countByKey(archived);
  return [...new Set([...live.keys(), ...old.keys()])].map((key) => ({
    key,
    current: live.get(key) ?? 0,
    archive: old.get(key) ?? 0,
  }));
};

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
  id,
  title,
  meta,
  empty,
  items,
  threshold,
}: {
  id: string;
  title: string;
  meta: string;
  empty: string;
  items: FileFailureKey[];
  /** Omitted where counts no longer drive alerts. */
  threshold?: number;
}) => (
  <section aria-labelledby={id}>
    <header className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
      <h2 id={id} className="m-0 text-base font-semibold">
        {title}
      </h2>
      <span className="font-mono text-[0.7rem] text-icon">{meta}</span>
    </header>
    {items.length === 0 ? (
      <p className="m-0 rounded-xl border border-dashed border-line px-4 py-10 text-center text-[0.86rem] text-icon">
        {empty}
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
                threshold !== undefined && item.count > threshold
                  ? 'text-error'
                  : 'text-ink',
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

const PurgeFields = ({
  value,
  onChange,
  tallies,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  tallies: KeyTally[];
  error: string | null;
}) => {
  const query = value.trim();
  const exact = tallies.find((row) => row.key === query);
  const suggestions = tallies
    .filter((row) => row.key !== query && row.key.includes(query))
    .slice(0, SUGGESTION_LIMIT);

  return (
    <div className="grid gap-2.5">
      <label htmlFor="purge-file-key" className="grid text-[0.8rem] text-muted">
        filekey
        <Input
          id="purge-file-key"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例如 ikrTh47rhbmj"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-[0.86rem]"
        />
      </label>
      {query ? (
        <p className="m-0 text-[0.76rem] text-icon">
          {exact
            ? `将删除现有 ${exact.current} 条、归档 ${exact.archive} 条`
            : '监控里没有这个 key 的记录'}
        </p>
      ) : null}
      {suggestions.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {suggestions.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onChange(row.key)}
                className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.74rem] text-muted transition-colors hover:bg-mist hover:text-ink"
              >
                {row.key}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className={ERROR_NOTE}>{error}</p> : null}
    </div>
  );
};

export const FileFailuresPage = ({ refreshToken, onUnauthorized }: Props) => {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [keys, setKeys] = useState<FileFailureKey[]>([]);
  const [items, setItems] = useState<FileFailureItem[]>([]);
  const [archive, setArchive] = useState(EMPTY_ARCHIVE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [purgeKey, setPurgeKey] = useState('');

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
    setArchive(result.archive ?? EMPTY_ARCHIVE);
    setLoading(false);
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const tallies = useMemo(
    () => tallyKeys(keys, archive.keys),
    [keys, archive.keys],
  );

  const run = async (
    kind: Exclude<Pending, null>,
    action: () => Promise<{ success: boolean; message?: string }>,
  ): Promise<boolean> => {
    setPending(kind);
    setActionError(null);
    const result = await action();
    setPending(null);
    if (!result.success) {
      if (result.message === 'unauthorized') onUnauthorized();
      else setActionError(result.message || '操作失败');
      return false;
    }
    void load();
    return true;
  };

  const resetDialog = (open: boolean) => {
    if (open) return;
    setActionError(null);
    setPurgeKey('');
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
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
        <div className="flex flex-wrap items-center gap-2">
          <ConfirmDialog
            className="theme-dark"
            trigger={
              <>
                <Archive size={13} className="text-icon" aria-hidden />
                清除所有
              </>
            }
            triggerClassName={ACTION}
            triggerDisabled={loading || items.length === 0}
            title="归档所有现有记录？"
            description="现有记录会整体移入归档，实时统计与告警从零开始计。归档不会删除，仍可在下方查看。"
            confirmLabel="归档"
            busy={pending === 'archive'}
            onConfirm={() => run('archive', archiveFileFailures)}
            onOpenChange={resetDialog}
          >
            {actionError ? <p className={ERROR_NOTE}>{actionError}</p> : null}
          </ConfirmDialog>
          <ConfirmDialog
            className="theme-dark"
            trigger={
              <>
                <Eraser size={13} className="text-icon" aria-hidden />
                清除 key
              </>
            }
            triggerClassName={ACTION}
            triggerDisabled={loading}
            title="清除哪个 key？"
            description="用于资源失效后重新上传的 key。现有与归档中该 key 的记录会被彻底删除，无法恢复。"
            confirmLabel="删除"
            tone="danger"
            busy={pending === 'purge'}
            confirmDisabled={!purgeKey.trim()}
            onConfirm={() =>
              run('purge', () => purgeFileFailureKey(purgeKey.trim()))
            }
            onOpenChange={resetDialog}
          >
            <PurgeFields
              value={purgeKey}
              onChange={setPurgeKey}
              tallies={tallies}
              error={actionError}
            />
          </ConfirmDialog>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={ACTION}
          >
            <RefreshCw size={13} className="text-icon" aria-hidden />
            刷新
          </button>
        </div>
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
            <div className="grid gap-8">
              <KeyList
                id="failure-keys"
                title="30 日内按 key"
                meta={`阈值 > ${summary.alertThreshold}`}
                empty="30 日内没有解析失败"
                items={keys}
                threshold={summary.alertThreshold}
              />
              <KeyList
                id="failure-archive"
                title="归档"
                meta={`共 ${archive.total} 条 · ${archive.keys.length} 个 key`}
                empty="还没有归档记录"
                items={archive.keys}
              />
            </div>
            <FailureLog items={items} />
          </div>
        </>
      )}
    </div>
  );
};
