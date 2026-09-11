import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { cn } from '~/lib/cn';
import type { CategoryTotal } from '../utils/aggregate';
import { categoryColor } from '../utils/categoryTone';

type Props = {
  totals: CategoryTotal[];
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
};

const share = (part: number, whole: number): string =>
  whole === 0 ? '0%' : `${((part / whole) * 100).toFixed(1)}%`;

/**
 * Doubles as the colour key for the 去向 tag on each ranking row, so the legend
 * lists every 类别 even when its slice is too thin to see. Slices and legend
 * rows are shortcuts into the 去向 filter, not a separate selection state.
 */
const CategoryDonut = ({ totals, activeCategory, onSelectCategory }: Props) => {
  const people = totals.reduce((sum, row) => sum + row.people, 0);
  if (people === 0) return null;

  const toggle = (category: string) =>
    onSelectCategory(activeCategory === category ? null : category);

  const focus =
    totals.find((row) => row.category === activeCategory) ?? totals[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[8.5rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={totals}
              dataKey="people"
              nameKey="category"
              innerRadius="66%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={1.5}
              strokeWidth={0}
              animationDuration={550}
              animationEasing="ease-out"
              onClick={(_, index) => {
                const category = totals[index]?.category;
                if (category) toggle(category);
              }}
            >
              {totals.map((row) => (
                <Cell
                  key={row.category}
                  fill={categoryColor(row.category)}
                  cursor="pointer"
                  opacity={
                    activeCategory === null || activeCategory === row.category
                      ? 1
                      : 0.3
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {focus ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg leading-none font-semibold text-ink tabular-nums">
              {share(focus.people, people)}
            </span>
            <span className="mt-0.5 max-w-[5.5rem] truncate text-[0.6875rem] text-muted">
              {focus.category}
            </span>
          </div>
        ) : null}
      </div>

      <ul className="flex flex-col gap-0.5">
        {totals.map((row) => (
          <li key={row.category}>
            <button
              type="button"
              onClick={() => toggle(row.category)}
              aria-pressed={activeCategory === row.category}
              className={cn(
                'flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[0.8125rem] transition-colors hover:bg-mist',
                activeCategory !== null &&
                  activeCategory !== row.category &&
                  'opacity-45',
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: categoryColor(row.category) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-ink">
                {row.category}
              </span>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {row.people.toLocaleString('zh-CN')}
              </span>
              <span className="w-11 shrink-0 text-right font-semibold text-ink tabular-nums">
                {share(row.people, people)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryDonut;
