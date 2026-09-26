import { Link } from '@tanstack/react-router';
import { ArrowLeftRight, BusFront, Clock3, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SelectField, type SelectOption } from '~/components/ui/select';
import { cn } from '~/lib/cn';
import {
  type BusDirection,
  type BusEndpointId,
  busEndpoints,
  busServiceLabel,
  directionFor,
  findRecentDeparture,
  findUpcomingBuses,
  formatBusDay,
  getShanghaiClock,
  type HolidayCalendar,
  selectBusEndpoint,
  upcomingBusesToShow,
} from './data';
import { useHolidayCalendar } from './holidays';

const EMPTY_HOLIDAYS: HolidayCalendar = {};

const countdownLabel = (minutes: number): string => {
  const rounded = Math.ceil(minutes);
  if (rounded <= 0) return '即将发车';
  if (rounded < 60) return `${rounded} 分钟后`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} 小时后` : `${hours} 小时 ${rest} 分钟后`;
};

const clockLabel = (minutes: number): string =>
  [Math.floor(minutes / 60), Math.floor(minutes % 60)]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');

const EndpointButtons = ({
  label,
  value,
  opposite,
  side,
  onChange,
}: {
  label: string;
  value: BusEndpointId | null;
  opposite: BusEndpointId | null;
  side: 'from' | 'to';
  onChange: (value: BusEndpointId) => void;
}) => (
  <fieldset className="m-0 min-w-0 border-0 p-0">
    <legend className="m-0 text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase">
      {label}
    </legend>
    <div className="mt-2 flex flex-wrap gap-2">
      {busEndpoints.map((endpoint) => {
        const selected = endpoint.id === value;
        const reachable =
          opposite === null ||
          (side === 'from'
            ? directionFor(endpoint.id, opposite)
            : directionFor(opposite, endpoint.id));
        return (
          <button
            key={endpoint.id}
            type="button"
            aria-pressed={selected}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              selected
                ? 'bg-ink text-paper'
                : reachable
                  ? 'bg-mist text-ink hover:bg-primary-soft hover:text-primary'
                  : 'bg-mist text-muted',
            )}
            onClick={() => onChange(endpoint.id)}
          >
            {endpoint.label}
          </button>
        );
      })}
    </div>
  </fieldset>
);

const EndpointSelect = ({
  label,
  value,
  opposite,
  side,
  onChange,
}: {
  label: string;
  value: BusEndpointId | null;
  opposite: BusEndpointId | null;
  side: 'from' | 'to';
  onChange: (value: BusEndpointId) => void;
}) => {
  const options: SelectOption<BusEndpointId>[] = busEndpoints.map(
    (endpoint) => ({
      value: endpoint.id,
      label: endpoint.label,
      muted:
        opposite !== null &&
        (side === 'from'
          ? directionFor(endpoint.id, opposite) === null
          : directionFor(opposite, endpoint.id) === null),
    }),
  );
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase">
        {label}
      </span>
      <SelectField
        value={value}
        options={options}
        onValueChange={onChange}
        ariaLabel={`选择${label}`}
        placeholder={`选择${label}`}
        className="w-full"
      />
    </div>
  );
};

const StopSelector = ({
  direction,
  selectedIndex,
  onSelect,
}: {
  direction: BusDirection;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) => {
  const stops = direction.trips[0]?.stops ?? [];
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="m-0 text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase">
        选择上车点
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {stops.map((stop, index) => {
          const active = index === selectedIndex;
          return (
            <span
              key={stop.stop}
              className={cn(
                'inline-flex items-stretch overflow-hidden rounded-md',
                active ? 'bg-primary-soft' : 'bg-mist',
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                className={cn(
                  'px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
                  active ? 'text-primary' : 'text-ink hover:text-primary',
                )}
                onClick={() => onSelect(index)}
              >
                {stop.stop}
              </button>
              {stop.map ? (
                <Link
                  to="/map"
                  search={stop.map}
                  aria-label={`在校园地图中查看${stop.stop}`}
                  title="在校园地图中查看"
                  className="inline-flex w-9 items-center justify-center border-l border-line text-icon transition-colors hover:text-icon-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                >
                  <MapPin className="h-4 w-4" />
                </Link>
              ) : null}
            </span>
          );
        })}
      </div>
    </fieldset>
  );
};

const NextDeparture = ({
  direction,
  stopIndex,
  clock,
  holidays,
}: {
  direction: BusDirection;
  stopIndex: number;
  clock: ReturnType<typeof getShanghaiClock>;
  holidays: HolidayCalendar;
}) => {
  const upcoming = findUpcomingBuses(direction, clock, holidays, stopIndex);
  const visible = upcomingBusesToShow(upcoming);
  const recent = findRecentDeparture(direction, clock, holidays, stopIndex);
  const departureStop = direction.trips[0]?.stops[stopIndex];

  return (
    <section aria-labelledby="next-bus-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="m-0 text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase">
            实时发车提示
          </p>
          <h2
            id="next-bus-heading"
            className="mt-1 mb-0 font-display text-xl font-semibold text-ink"
          >
            {departureStop?.stop ?? direction.from} → {direction.to}
          </h2>
        </div>
        <time className="font-mono text-xs text-muted tabular-nums">
          当前 {clockLabel(clock.minutes)}
        </time>
      </div>
      <div
        className={cn(
          'mt-3 grid gap-3',
          visible.length > 1 && 'sm:grid-cols-2',
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {visible.map(({ trip, dayOffset, minutesUntil }, index) => {
          const departure = trip.stops[stopIndex];
          if (!departure) return null;
          return (
            <article
              key={[dayOffset, trip.id].join('-')}
              className={cn(
                'relative overflow-hidden rounded-lg px-4 py-4 sm:px-5',
                index === 0 ? 'bg-primary text-paper' : 'bg-primary-soft',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className={cn(
                    'm-0 text-[0.68rem] font-semibold tracking-[0.12em] uppercase',
                    index === 0 ? 'text-paper' : 'text-muted',
                  )}
                >
                  {index === 0 ? '下一班' : '随后一班'}
                </p>
                <span
                  className={cn(
                    'text-[0.68rem] font-semibold',
                    index === 0 ? 'text-paper' : 'text-primary',
                  )}
                >
                  {formatBusDay(dayOffset, clock.dayOfWeek)} ·{' '}
                  {countdownLabel(minutesUntil)}
                </span>
              </div>
              <time
                className={cn(
                  'mt-4 block font-mono text-[2.45rem] leading-none font-semibold tracking-[-0.05em] tabular-nums sm:text-[2.9rem]',
                  index === 0 ? 'text-paper' : 'text-ink',
                )}
              >
                {departure.time}
              </time>
              <p
                className={cn(
                  'mt-2 mb-0 text-xs',
                  index === 0 ? 'text-paper' : 'text-muted',
                )}
              >
                {departure.stop}发车
              </p>
            </article>
          );
        })}
      </div>
      {recent ? (
        <p className="mt-2 mb-0 text-right text-xs text-muted">
          <span className="mr-2">刚刚发车</span>
          <time className="font-mono font-semibold text-ink tabular-nums">
            {recent.trip.stops[stopIndex]?.time}
          </time>
        </p>
      ) : null}
    </section>
  );
};

const ScheduleTable = ({
  direction,
  selectedStopIndex,
  clock,
  holidays,
}: {
  direction: BusDirection;
  selectedStopIndex: number;
  clock: ReturnType<typeof getShanghaiClock>;
  holidays: HolidayCalendar;
}) => {
  const stops = direction.trips[0]?.stops ?? [];
  const recent = findRecentDeparture(
    direction,
    clock,
    holidays,
    selectedStopIndex,
  );
  const highlightedTripIds = new Set([
    ...upcomingBusesToShow(
      findUpcomingBuses(direction, clock, holidays, selectedStopIndex),
    )
      .filter(({ dayOffset }) => dayOffset === 0)
      .map(({ trip }) => trip.id),
    ...(recent ? [recent.trip.id] : []),
  ]);

  return (
    <section aria-labelledby="all-buses-heading">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <p className="m-0 flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase">
            <Clock3 className="h-3.5 w-3.5 text-icon" />
            全部班次
          </p>
          <h2
            id="all-buses-heading"
            className="mt-1 mb-0 font-display text-xl font-semibold text-ink"
          >
            {direction.label}
          </h2>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
          <BusFront className="h-4 w-4 text-icon" />
          {direction.trips.length} 班
        </span>
      </div>
      <div className="overflow-x-auto border-y border-line">
        <table className="m-0 w-full min-w-[38rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-12" />
            {stops.map(({ stop }) => (
              <col key={stop} />
            ))}
            <col className="w-36" />
          </colgroup>
          <thead>
            <tr className="text-left text-[0.7rem] tracking-wide text-muted">
              <th className="border-b border-line px-2 py-2.5 font-semibold">
                班次
              </th>
              {stops.map(({ stop }, index) => (
                <th
                  key={stop}
                  className={cn(
                    'border-b border-line px-2 py-2.5 text-center font-semibold',
                    index === selectedStopIndex && 'text-primary',
                  )}
                >
                  {stop}
                </th>
              ))}
              <th className="border-b border-line px-2 py-2.5 text-center font-semibold">
                运行
              </th>
            </tr>
          </thead>
          <tbody>
            {direction.trips.map((trip) => {
              const highlighted = highlightedTripIds.has(trip.id);
              return (
                <tr
                  key={trip.id}
                  className={cn(highlighted && 'bg-primary-faint')}
                >
                  <td className="border-b border-line px-2 py-2.5 font-mono text-xs font-semibold text-muted tabular-nums">
                    {trip.id}
                  </td>
                  {trip.stops.map(({ stop, time }, index) => (
                    <td
                      key={stop}
                      className={cn(
                        'border-b border-line px-2 py-2.5 text-center font-mono font-medium text-ink tabular-nums',
                        index === selectedStopIndex && 'text-primary',
                      )}
                    >
                      {time}
                    </td>
                  ))}
                  <td className="border-b border-line px-2 py-2.5 text-center text-xs leading-snug text-muted">
                    {busServiceLabel(trip.service) ?? '每日'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {direction.routeNote ? (
        <p className="mt-2 mb-0 text-xs leading-relaxed text-muted">
          {direction.routeNote}
        </p>
      ) : null}
    </section>
  );
};

const BusTimeTable = () => {
  const [clock, setClock] = useState(() => getShanghaiClock(new Date()));
  const [fromId, setFromId] = useState<BusEndpointId | null>('shapingba');
  const [toId, setToId] = useState<BusEndpointId | null>('science');
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);
  const {
    data: holidayData,
    isError: holidayError,
    isPending: holidayPending,
  } = useHolidayCalendar(clock.dateKey);
  const holidays = holidayData?.calendar ?? EMPTY_HOLIDAYS;
  const direction = directionFor(fromId, toId);
  const calendarReady = !holidayPending;

  const selectFrom = (next: BusEndpointId) => {
    const selection = selectBusEndpoint({ fromId, toId }, 'from', next);
    setFromId(selection.fromId);
    setToId(selection.toId);
    setSelectedStopIndex(0);
  };
  const selectTo = (next: BusEndpointId) => {
    const selection = selectBusEndpoint({ fromId, toId }, 'to', next);
    setFromId(selection.fromId);
    setToId(selection.toId);
    setSelectedStopIndex(0);
  };
  const swapEndpoints = () => {
    if (fromId === null || toId === null) return;
    setFromId(toId);
    setToId(fromId);
    setSelectedStopIndex(0);
  };

  useEffect(() => {
    const interval = window.setInterval(
      () => setClock(getShanghaiClock(new Date())),
      30_000,
    );
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="my-2 flex flex-col gap-6" aria-label="校车时刻表">
      <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-end gap-2 sm:hidden">
        <EndpointSelect
          label="起点"
          value={fromId}
          opposite={toId}
          side="from"
          onChange={selectFrom}
        />
        <button
          type="button"
          aria-label="交换起点和终点"
          disabled={fromId === null || toId === null}
          className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-icon transition-colors hover:bg-mist hover:text-icon-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={swapEndpoints}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <EndpointSelect
          label="终点"
          value={toId}
          opposite={fromId}
          side="to"
          onChange={selectTo}
        />
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-end gap-3 sm:grid">
        <EndpointButtons
          label="起点"
          value={fromId}
          opposite={toId}
          side="from"
          onChange={selectFrom}
        />
        <button
          type="button"
          aria-label="交换起点和终点"
          disabled={fromId === null || toId === null}
          className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-icon transition-colors hover:bg-mist hover:text-icon-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={swapEndpoints}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <EndpointButtons
          label="终点"
          value={toId}
          opposite={fromId}
          side="to"
          onChange={selectTo}
        />
      </div>

      {direction ? (
        <>
          <StopSelector
            direction={direction}
            selectedIndex={selectedStopIndex}
            onSelect={setSelectedStopIndex}
          />
          {calendarReady ? (
            <NextDeparture
              direction={direction}
              stopIndex={selectedStopIndex}
              clock={clock}
              holidays={holidays}
            />
          ) : (
            <div
              className="h-32 animate-pulse rounded-lg bg-mist motion-reduce:animate-none"
              aria-label="正在获取节假日与下一班信息"
              aria-busy
            />
          )}
          <ScheduleTable
            direction={direction}
            selectedStopIndex={selectedStopIndex}
            clock={clock}
            holidays={holidays}
          />
        </>
      ) : (
        <p className="m-0 border-l-2 border-primary px-3 py-2 text-sm text-muted">
          继续选择起点或终点后显示班次
        </p>
      )}

      <div className="border-l-2 border-primary px-3 py-1 text-xs leading-relaxed text-muted">
        <p className="m-0">
          各班次请提前 15 分钟到位等候；临时调整以校方通知为准
        </p>
        {holidayError ? (
          <p className="mt-1 mb-0 text-error">
            节假日数据暂时无法更新，当前提示仅按自然星期估算。
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default BusTimeTable;
