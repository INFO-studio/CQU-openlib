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

/**
 * One ranked 单位.
 *
 * The name is the row, so it wraps rather than truncates — an ellipsis on a
 * phone leaves nothing to identify. The 去向 rides inline at the end of the
 * name instead of holding a column, which keeps a short name and its tag on
 * one line and spends a second line only on a long one. Below sm the count
 * and the share stack into one narrow column at tight leading: two columns
 * side by side cost 92px of a 366px row, the stack costs 36px. That stack is
 * the tallest thing in the row, and its baseline is its first line, so the
 * row centres its items below sm instead — baseline alignment would hang the
 * share below the name's baseline and open a gap under one and above the
 * other. Widths are min-widths, so right edges stay aligned down the list
 * while a four-digit count takes the room it needs.
 */
const OrgRow = ({ row, rank, peak, total, showCategory }: Props) => (
  <li className="flex items-center gap-2 border-b border-line py-[0.4rem] sm:items-baseline sm:gap-3">
    <span className="min-w-6 shrink-0 text-right text-xs text-muted tabular-nums">
      {rank}
    </span>
    <span className="min-w-0 flex-1 text-[0.875rem] leading-[1.45] break-words text-ink">
      {row.org}
      {showCategory ? (
        <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[0.6875rem] whitespace-nowrap text-muted">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: categoryColor(row.category) }}
            aria-hidden
          />
          {row.category}
        </span>
      ) : null}
    </span>
    <span className="hidden h-1.5 w-20 shrink-0 self-center overflow-hidden rounded-full bg-mist sm:block">
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.max(2, (row.people / peak) * 100)}%`,
          background: categoryColor(row.category),
        }}
      />
    </span>
    <span className="flex min-w-9 shrink-0 flex-col items-end leading-[1.05] sm:min-w-0 sm:flex-row sm:items-baseline sm:gap-3 sm:leading-[1.45]">
      <span className="text-[0.75rem] font-semibold text-ink tabular-nums sm:min-w-10 sm:text-right sm:text-[0.875rem]">
        {row.people}
      </span>
      <span className="text-[0.625rem] text-muted tabular-nums sm:w-12 sm:text-right sm:text-xs">
        {total === 0 ? '—' : `${((row.people / total) * 100).toFixed(1)}%`}
      </span>
    </span>
  </li>
);

export default OrgRow;
