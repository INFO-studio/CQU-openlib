/**
 * Composition per 届, normalised to 100%.
 *
 * Sizing the bars by cohort headcount — the obvious first move — plots how many
 * people each 院系 graduated, not where they went. Normalising puts all ten 届
 * on one axis so a real shift is the only thing that moves.
 */
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { colors } from '~/theme/colors';
import type { GradePoint } from '../utils/aggregate';
import { categoryColor } from '../utils/categoryTone';

type Props = {
  points: GradePoint[];
  categories: string[];
  activeGrade: number | null;
  onSelectGrade: (grade: number | null) => void;
};

type Datum = Record<string, number | string>;

const GradeTrend = ({
  points,
  categories,
  activeGrade,
  onSelectGrade,
}: Props) => {
  if (points.length < 2) return null;

  const data: Datum[] = points.map((point) => {
    const row: Datum = {
      grade: String(point.grade).slice(2),
      raw: point.grade,
    };
    for (const [k, category] of categories.entries()) {
      const value = point.byCategory[k] ?? 0;
      row[category] = point.people === 0 ? 0 : (value / point.people) * 100;
    }
    return row;
  });

  return (
    <div className="h-32 -ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
          barCategoryGap="18%"
          onClick={(state) => {
            // recharts hands back the tick index, not the datum itself.
            const index = Number(state?.activeIndex);
            const grade = Number.isInteger(index)
              ? points[index]?.grade
              : undefined;
            if (grade === undefined) return;
            onSelectGrade(activeGrade === grade ? null : grade);
          }}
        >
          <XAxis
            dataKey="grade"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: colors.muted, fontSize: 10 }}
          />
          <YAxis hide domain={[0, 100]} />
          {categories.map((category, k) => (
            <Bar
              key={category}
              dataKey={category}
              stackId="go"
              isAnimationActive
              animationDuration={520}
              animationEasing="ease-out"
              // Rounds only the topmost visible segment of each column.
              radius={k === categories.length - 1 ? [2, 2, 0, 0] : 0}
            >
              {data.map((row) => (
                <Cell
                  key={`${category}-${String(row.grade)}`}
                  fill={categoryColor(category)}
                  cursor="pointer"
                  opacity={
                    activeGrade === null || activeGrade === row.raw ? 1 : 0.35
                  }
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GradeTrend;
