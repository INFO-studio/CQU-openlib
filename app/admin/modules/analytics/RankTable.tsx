export type RankRow = {
  id: string;
  label: string;
  value: number;
  /** Second line — the fact that makes the count interpretable. */
  sub?: string;
};

/** Every panel body is the same height, so a row of panels always lines up. */
const BODY_HEIGHT = 'h-80';

type Props = {
  title: string;
  /** Only for behaviour the title cannot state, e.g. ignoring the range. */
  note?: string;
  rows: RankRow[];
  empty: string;
};

/**
 * A ranked list with a proportional bar behind each row. The bar is what makes
 * a long-tail distribution readable — the numbers alone force the reader to
 * divide in their head.
 */
export const RankTable = ({ title, note, rows, empty }: Props) => {
  const max = rows.reduce((peak, row) => Math.max(peak, row.value), 0);

  return (
    <section className="min-w-0 rounded-xl border border-line bg-panel p-4">
      <header className="mb-2.5 flex items-center gap-2">
        <h3 className="m-0 text-[0.95rem] font-semibold">{title}</h3>
        {note ? (
          <span className="rounded border border-line px-1.5 py-0.5 text-[0.7rem] text-icon">
            {note}
          </span>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <p
          className={`m-0 grid place-items-center text-[0.82rem] text-icon ${BODY_HEIGHT}`}
        >
          {empty}
        </p>
      ) : (
        // Fixed height so a 20-row panel can't stretch the page into a tower;
        // the list scrolls inside instead.
        <ol
          className={`m-0 flex list-none flex-col gap-px overflow-y-auto p-0 pr-1 [scrollbar-color:var(--c-rule)_transparent] [scrollbar-width:thin] ${BODY_HEIGHT}`}
        >
          {rows.map((row) => (
            // `shrink-0` is load-bearing: `overflow-hidden` drops the automatic
            // minimum size to 0, so without it the rows compress to fit instead
            // of overflowing into a scroll.
            <li
              key={row.id}
              className="relative shrink-0 overflow-hidden rounded"
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary-faint"
                style={{ width: `${max ? (row.value / max) * 100 : 0}%` }}
                aria-hidden
              />
              <div className="relative flex items-baseline justify-between gap-3 px-2 py-1">
                <span className="min-w-0">
                  <span className="block truncate text-[0.8rem] leading-tight text-ink">
                    {row.label}
                  </span>
                  {row.sub ? (
                    <span className="mt-px block truncate text-[0.68rem] leading-tight text-icon">
                      {row.sub}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 whitespace-nowrap text-[0.78rem] leading-tight tabular-nums text-muted">
                  {row.value.toLocaleString('zh-CN')}
                  <span className="ml-0.5 text-[0.66rem] text-icon">次</span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
