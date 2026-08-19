import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyPoint } from '~/admin/lib/analytics';
import { colors } from '~/theme/colors';

/** '2026-08-05' → '08-05'; thirty full dates will not fit on one axis. */
const shortDate = (date: string): string => date.slice(5);

const AXIS = {
  stroke: colors.line,
  tick: { fill: colors.icon, fontSize: 11 },
  tickLine: false,
} as const;

/**
 * Loaded through `React.lazy` from the page, which is what keeps recharts out
 * of every reader's bundle — it ships only to whoever opens this console.
 */
const TrendChart = ({ data }: { data: DailyPoint[] }) => (
  <ResponsiveContainer width="100%" height={220}>
    <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
      <defs>
        <linearGradient id="trend-views" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.primary} stopOpacity={0.32} />
          <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
        </linearGradient>
      </defs>

      <CartesianGrid stroke={colors.line} vertical={false} />
      <XAxis
        {...AXIS}
        dataKey="date"
        tickFormatter={shortDate}
        minTickGap={16}
      />
      <YAxis {...AXIS} allowDecimals={false} width={44} />
      <Tooltip
        cursor={{ stroke: colors.line }}
        contentStyle={{
          background: colors.elev,
          border: `1px solid ${colors.line}`,
          borderRadius: '0.5rem',
          fontSize: '0.78rem',
        }}
        labelStyle={{ color: colors.muted }}
        itemStyle={{ color: colors.ink }}
      />

      <Area
        type="monotone"
        dataKey="views"
        name="浏览"
        stroke={colors.primary}
        strokeWidth={2}
        fill="url(#trend-views)"
      />
      <Area
        type="monotone"
        dataKey="sessions"
        name="会话"
        stroke={colors.icon}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        fill="none"
      />
    </AreaChart>
  </ResponsiveContainer>
);

export default TrendChart;
