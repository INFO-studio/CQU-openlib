import type { OrgTotal } from '../utils/aggregate';
import { categoryColor } from '../utils/categoryTone';

type Props = {
  row: OrgTotal;
  rank: number;
  /** Largest count in the same ranking, for the inline bar. */
  peak: number;
  /** Headcount of the whole current scope, the denominator for the share. */
  total: number;
  /** Hidden once the whole list is one 去向, where it would just repeat. */
  showCategory: boolean;
};

const OrgRow = ({ row, rank, peak, total, showCategory }: Props) => (
  <li className="flex items-center gap-2.5 border-b border-line py-[0.4rem] sm:gap-3">
    <span className="w-6 shrink-0 text-right text-xs text-muted tabular-nums">
      {rank}
    </span>
    <span
      className="min-w-0 flex-1 truncate text-[0.875rem] text-ink"
      title={row.org}
    >
      {row.org}
    </span>
    {showCategory ? (
      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted sm:flex">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: categoryColor(row.category) }}
          aria-hidden
        />
        {row.category}
      </span>
    ) : null}
    <span className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-mist sm:block">
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.max(2, (row.people / peak) * 100)}%`,
          background: categoryColor(row.category),
        }}
      />
    </span>
    <span className="w-10 shrink-0 text-right text-[0.875rem] font-semibold text-ink tabular-nums">
      {row.people}
    </span>
    <span className="w-12 shrink-0 text-right text-xs text-muted tabular-nums">
      {total === 0 ? '—' : `${((row.people / total) * 100).toFixed(1)}%`}
    </span>
  </li>
);

export default OrgRow;
