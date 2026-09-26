import { describe, expect, it } from 'vite-plus/test';
import {
  busDirections,
  directionFor,
  findRecentDeparture,
  findUpcomingBuses,
  getShanghaiClock,
  selectBusEndpoint,
  serviceRunsOnDay,
  upcomingBusesToShow,
} from '~/components/doc/BusTimeTable/data';

const direction = (id: string) => {
  const result = busDirections.find((item) => item.id === id);
  if (!result) throw new Error(`missing test direction: ${id}`);
  return result;
};

const NO_HOLIDAYS = {};

describe('busTimetable', () => {
  it('reads the current clock in Asia/Shanghai', () => {
    expect(getShanghaiClock(new Date('2026-09-26T00:05:30Z'))).toEqual({
      dateKey: '2026-09-26',
      dayOfWeek: 6,
      minutes: 8 * 60 + 5.5,
    });
  });

  it('finds the next departure from the selected stop', () => {
    const upcoming = findUpcomingBuses(
      direction('shapingba-to-science'),
      { dateKey: '2026-09-19', dayOfWeek: 6, minutes: 7 * 60 + 21 },
      NO_HOLIDAYS,
      1,
    );

    expect(
      upcoming.map(({ trip, minutesUntil }) => [trip.id, minutesUntil]),
    ).toEqual([
      ['1', 4],
      ['2', 24],
    ]);
  });

  it('shows two departures only when the next leaves within fifteen minutes', () => {
    const close = findUpcomingBuses(
      direction('shapingba-to-science'),
      {
        dateKey: '2026-09-21',
        dayOfWeek: 1,
        minutes: 7 * 60 + 10,
      },
      NO_HOLIDAYS,
    );
    const later = findUpcomingBuses(
      direction('shapingba-to-science'),
      { dateKey: '2026-09-21', dayOfWeek: 1, minutes: 6 * 60 },
      NO_HOLIDAYS,
    );

    expect(upcomingBusesToShow(close)).toHaveLength(2);
    expect(upcomingBusesToShow(later)).toHaveLength(1);
  });

  it('combines natural weekdays with holiday-cn off-day data', () => {
    expect(serviceRunsOnDay('exceptSunday', 6, true)).toBe(false);
    expect(serviceRunsOnDay('weekendAndHolidays', 6, true)).toBe(true);
    expect(serviceRunsOnDay('weekdayOnly', 0, false)).toBe(false);

    const holidayUpcoming = findUpcomingBuses(
      direction('shapingba-to-science'),
      { dateKey: '2026-09-26', dayOfWeek: 6, minutes: 7 * 60 },
      { '2026-09-26': true },
    );
    expect(holidayUpcoming[0]?.trip.stops[0]?.time).toBe('08:10');
  });

  it('keeps a departure from the last five minutes as a trailing reminder', () => {
    const route = direction('shapingba-to-science');
    const clock = {
      dateKey: '2026-09-21',
      dayOfWeek: 1,
      minutes: 7 * 60 + 25,
    };

    expect(findUpcomingBuses(route, clock, NO_HOLIDAYS)[0]?.trip.id).toBe('2');
    expect(findRecentDeparture(route, clock, NO_HOLIDAYS)?.trip.id).toBe('1');
    expect(
      findRecentDeparture(
        route,
        { ...clock, minutes: 7 * 60 + 25.01 },
        NO_HOLIDAYS,
      ),
    ).toBeNull();
  });

  it('only exposes route pairs that exist in the timetable', () => {
    expect(directionFor('shapingba', 'science')?.id).toBe(
      'shapingba-to-science',
    );
    expect(directionFor('shapingba', 'transient')).toBeNull();
    expect(directionFor('engineer', 'shapingba')?.id).toBe(
      'engineer-to-campus-a',
    );
  });

  it('clears the opposite endpoint when a clicked pair has no route', () => {
    expect(
      selectBusEndpoint(
        { fromId: 'shapingba', toId: 'science' },
        'to',
        'transient',
      ),
    ).toEqual({ fromId: null, toId: 'transient' });
    expect(
      selectBusEndpoint(
        { fromId: 'science', toId: 'transient' },
        'from',
        'shapingba',
      ),
    ).toEqual({ fromId: 'shapingba', toId: null });
  });

  it('keeps the transient route ahead of the engineer route', () => {
    expect(
      busDirections
        .filter(
          ({ id }) =>
            id === 'huxi-to-transient' || id === 'science-to-engineer',
        )
        .map(({ id }) => id),
    ).toEqual(['huxi-to-transient', 'science-to-engineer']);
  });
});
