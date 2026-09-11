/**
 * The ranking, revealed 40 rows at a time from pages of 500.
 *
 * Two different things can satisfy the sentinel: rows already fetched but not
 * yet rendered, or the next page over the network. Reveal beats fetch, so a
 * reader who stops before rank 500 — nearly everyone — never triggers a second
 * request.
 */
import { useCallback, useEffect, useState } from 'react';
import { Bone } from '~/components/ui/skeleton';
import type { OrgTotal } from '../utils/aggregate';
import OrgRow from './OrgRow';

const PAGE_SIZE = 40;

type Props = {
  rows: OrgTotal[];
  shown: number;
  loading: boolean;
  /** More rows exist on the server beyond what `rows` holds. */
  hasMore: boolean;
  /** Denominator for each row's share — the whole scope, not the page. */
  total: number;
  /** False when a single 去向 is selected and the per-row tag is redundant. */
  showCategory: boolean;
  /** People the threshold withheld, per 去向. */
  withheld: { category: string; people: number }[];
  onReveal: () => void;
  onFetchMore: () => void;
};

/**
 * The residual, closing the list and deliberately unranked.
 *
 * It cannot join the ranking: on the default view it is 15,165 人, which would
 * take first place from 重庆大学 and read as if 「其他」 were a destination. So
 * it trails the ranking with no rank number, where it reads as the caveat it
 * is rather than as a competitor.
 */
const WithheldRow = ({ people, total }: { people: number; total: number }) => (
  <div className="flex items-center gap-2.5 border-b border-line py-[0.4rem] sm:gap-3">
    <span className="w-6 shrink-0" aria-hidden />
    <span className="min-w-0 flex-1 truncate text-[0.875rem] text-muted">
      其他（单个去向人数过少）
    </span>
    <span className="hidden w-20 shrink-0 sm:block" aria-hidden />
    <span className="w-10 shrink-0 text-right text-[0.875rem] font-semibold text-muted tabular-nums">
      {people}
    </span>
    <span className="w-12 shrink-0 text-right text-xs text-muted tabular-nums">
      {total === 0 ? '—' : `${((people / total) * 100).toFixed(1)}%`}
    </span>
  </div>
);

const OrgList = ({
  rows,
  shown,
  loading,
  hasMore,
  total,
  showCategory,
  withheld,
  onReveal,
  onFetchMore,
}: Props) => {
  // A callback ref, not useRef: the sentinel unmounts once the ranking runs
  // out, and a ref object would leave the observer pointed at nothing.
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const canReveal = rows.length > shown;
  const active = canReveal || hasMore;

  const advance = useCallback(() => {
    if (canReveal) onReveal();
    else onFetchMore();
  }, [canReveal, onReveal, onFetchMore]);

  useEffect(() => {
    if (!sentinel || !active) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) advance();
      },
      { rootMargin: '400px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [sentinel, active, advance]);

  if (loading) {
    return (
      <ul
        className="m-0 flex list-none flex-col gap-[1.15rem] pt-2 pl-0"
        aria-busy
        aria-label="加载中"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <Bone
              className="h-3.5"
              style={{ width: `${38 + ((i * 17) % 42)}%` }}
            />
            <Bone className="h-3.5 w-8 shrink-0" />
          </li>
        ))}
      </ul>
    );
  }

  // Summed across 去向 when nothing is filtered: five 「其他」 rows stacked at
  // the top would crowd out the ranking they are supposed to annotate.
  const hidden = withheld.reduce((sum, w) => sum + w.people, 0);

  if (rows.length === 0 && hidden === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        当前筛选下没有数据。
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {/* The rank is rendered per row, so the UA's own list marker and its
          40px indent are dead weight. */}
      <ol className="m-0 flex list-none flex-col pl-0">
        {rows.slice(0, shown).map((row, i) => (
          <OrgRow
            key={`${row.category}|${row.org}`}
            row={row}
            rank={i + 1}
            peak={rows[0]?.people ?? 1}
            total={total}
            showCategory={showCategory}
          />
        ))}
      </ol>
      {active ? (
        <div ref={setSentinel} className="flex flex-col gap-3 py-3">
          <Bone className="h-3.5 w-[46%]" />
          <Bone className="h-3.5 w-[38%]" />
        </div>
      ) : null}
      {hidden > 0 ? <WithheldRow people={hidden} total={total} /> : null}
    </div>
  );
};

export { PAGE_SIZE };
export default OrgList;
