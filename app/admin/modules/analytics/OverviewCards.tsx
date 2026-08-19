import type { Overview } from '~/admin/lib/analytics';

/**
 * Four numbers, no captions. These are standard traffic metrics; a line of
 * prose restating what each one counts costs a read and adds nothing.
 */
const cards = (overview: Overview): { label: string; value: string }[] => [
  { label: '浏览量', value: overview.views.toLocaleString('zh-CN') },
  { label: '会话数', value: overview.sessions.toLocaleString('zh-CN') },
  { label: '每会话页数', value: overview.viewsPerSession.toFixed(2) },
  { label: '跳出率', value: `${Math.round(overview.bounceRate * 100)}%` },
];

export const OverviewCards = ({ overview }: { overview: Overview }) => (
  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
    {cards(overview).map((card) => (
      <div
        key={card.label}
        className="rounded-xl border border-line bg-panel px-4 py-3.5"
      >
        <p className="m-0 text-[0.78rem] text-icon">{card.label}</p>
        <p className="m-0 mt-1.5 text-[1.75rem] font-semibold leading-none tabular-nums">
          {card.value}
        </p>
      </div>
    ))}
  </div>
);
