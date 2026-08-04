import { Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FormType } from '~/admin/lib/api';
import {
  STATUS_META,
  SUBMISSION_STATUSES,
  type SubmissionStatus,
} from '~/admin/lib/status';
import { FORM_TYPE_META } from '~/admin/modules/submissions/labels';
import { cn } from '~/lib/cn';

const PANEL = 'rounded-xl border border-line bg-panel p-3.5';
const LEGEND =
  'm-0 mb-2.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-icon';

type Facet<T extends string> = {
  value: T | '';
  label: string;
  tone?: string;
};

const TYPE_FACETS: Facet<FormType>[] = [
  { value: '', label: '全部类型' },
  ...Object.entries(FORM_TYPE_META).map(([value, meta]) => ({
    value: value as FormType,
    label: meta.label,
    tone: meta.tone,
  })),
];

const STATUS_FACETS: Facet<SubmissionStatus>[] = [
  { value: '', label: '全部状态' },
  ...SUBMISSION_STATUSES.map((value) => ({
    value,
    label: STATUS_META[value].label,
    tone: STATUS_META[value].tone,
  })),
];

type FacetListProps<T extends string> = {
  legend: string;
  facets: Facet<T>[];
  active: T | '';
  counts: Record<string, number>;
  total: number;
  onSelect: (value: T | '') => void;
};

const FacetList = <T extends string>({
  legend,
  facets,
  active,
  counts,
  total,
  onSelect,
}: FacetListProps<T>) => (
  <div className="grid" role="group" aria-label={legend}>
    {facets.map((facet) => {
      const count = facet.value === '' ? total : (counts[facet.value] ?? 0);
      const isActive = active === facet.value;
      return (
        <button
          key={facet.value || 'all'}
          type="button"
          aria-pressed={isActive}
          disabled={count === 0 && !isActive && facet.value !== ''}
          onClick={() => onSelect(isActive && facet.value ? '' : facet.value)}
          className={cn(
            'grid grid-cols-[0.45rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.84rem] transition-colors disabled:pointer-events-none disabled:opacity-40',
            isActive
              ? 'bg-primary-soft text-ink'
              : 'text-muted hover:bg-mist hover:text-ink',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'h-[0.45rem] w-[0.45rem] rounded-full',
              !facet.tone && 'shadow-chip-outline',
            )}
            style={facet.tone ? { background: facet.tone } : undefined}
          />
          <span>{facet.label}</span>
          <span className="font-mono text-[0.76rem] tabular-nums text-icon">
            {count}
          </span>
        </button>
      );
    })}
  </div>
);

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  type: '' | FormType;
  onTypeChange: (value: '' | FormType) => void;
  typeCounts: Record<string, number>;
  status: '' | SubmissionStatus;
  onStatusChange: (value: '' | SubmissionStatus) => void;
  statusCounts: Record<string, number>;
  total: number;
  onReset: () => void;
};

/**
 * Right rail: search, type facets, and the status ledger.
 * The ledger is both the tally and the filter — triage is this console's job.
 */
export const FilterRail = ({
  query,
  onQueryChange,
  type,
  onTypeChange,
  typeCounts,
  status,
  onStatusChange,
  statusCounts,
  total,
  onReset,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable)
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const ledgerTotal = SUBMISSION_STATUSES.reduce(
    (sum, s) => sum + (statusCounts[s] ?? 0),
    0,
  );
  const spread = SUBMISSION_STATUSES.filter((s) => (statusCounts[s] ?? 0) > 0);

  return (
    <aside
      aria-label="筛选"
      className="order-first grid gap-4 self-start sm:grid-cols-2 xl:order-none xl:sticky xl:top-6 xl:grid-cols-1"
    >
      <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2 transition-colors focus-within:border-primary sm:col-span-2 xl:col-span-1">
        <Search size={14} aria-hidden className="shrink-0 text-icon" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索字段或 ID"
          aria-label="搜索提交记录"
          className="min-w-0 flex-1 bg-transparent text-[0.85rem] placeholder:text-icon"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="清空搜索"
            className="grid shrink-0 place-items-center text-icon transition-colors hover:text-icon-strong"
          >
            <X size={14} />
          </button>
        ) : (
          <span
            aria-hidden
            className="shrink-0 rounded border border-line px-1.5 font-mono text-[0.66rem] text-icon"
          >
            /
          </span>
        )}
      </div>

      <section className={PANEL}>
        <p className={LEGEND}>状态台账</p>
        <div
          className="mb-3 flex h-[0.3rem] gap-0.5 overflow-hidden rounded-full"
          role={spread.length ? 'img' : undefined}
          aria-label={
            spread.length ? `共 ${ledgerTotal} 条，按状态分布` : undefined
          }
        >
          {spread.length ? (
            spread.map((s) => (
              <span
                key={s}
                className="min-w-[0.2rem] rounded-full transition-[flex-grow] duration-300"
                style={{
                  flexGrow: statusCounts[s] ?? 0,
                  background: STATUS_META[s].tone,
                }}
              />
            ))
          ) : (
            <span className="flex-1 rounded-full bg-line" />
          )}
        </div>
        <FacetList
          legend="按状态筛选"
          facets={STATUS_FACETS}
          active={status}
          counts={statusCounts}
          total={ledgerTotal}
          onSelect={onStatusChange}
        />
      </section>

      <section className={PANEL}>
        <p className={LEGEND}>表单类型</p>
        <FacetList
          legend="按类型筛选"
          facets={TYPE_FACETS}
          active={type}
          counts={typeCounts}
          total={total}
          onSelect={onTypeChange}
        />
      </section>

      {query.trim() || type || status ? (
        <button
          type="button"
          onClick={onReset}
          className="justify-self-start px-1 py-1 text-[0.78rem] text-icon underline underline-offset-4 transition-colors hover:text-ink sm:col-span-2 xl:col-span-1"
        >
          清除筛选
        </button>
      ) : null}
    </aside>
  );
};
