import { useQuery } from '@tanstack/react-query';
import type { HolidayCalendar } from './data';

type HolidayDay = {
  date: string;
  isOffDay: boolean;
};

type HolidayYear = {
  year: number;
  papers: string[];
  days: HolidayDay[];
};

type HolidayCalendarResult = {
  calendar: HolidayCalendar;
  missingYears: number[];
};

const holidayUrl = (year: number): string =>
  `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`;

const readHolidayYear = async (year: number): Promise<HolidayYear> => {
  const response = await fetch(holidayUrl(year));
  if (!response.ok) {
    throw new Error(`holiday-cn ${year}: HTTP ${response.status}`);
  }
  const value = (await response.json()) as Partial<HolidayYear>;
  if (
    value.year !== year ||
    !Array.isArray(value.papers) ||
    value.papers.length === 0 ||
    !Array.isArray(value.days)
  ) {
    throw new Error(`holiday-cn ${year}: invalid payload`);
  }
  return { year, papers: value.papers, days: value.days };
};

export const loadHolidayCalendar = async (
  years: number[],
): Promise<HolidayCalendarResult> => {
  const results = await Promise.allSettled(years.map(readHolidayYear));
  const loaded = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  if (!loaded.length) throw new Error('holiday-cn unavailable');

  return {
    calendar: Object.fromEntries(
      loaded.flatMap(({ days }) =>
        days.map(({ date, isOffDay }) => [date, isOffDay] as const),
      ),
    ),
    missingYears: years.filter(
      (year) => !loaded.some((dataset) => dataset.year === year),
    ),
  };
};

export const useHolidayCalendar = (dateKey: string) => {
  const year = Number(dateKey.slice(0, 4));
  return useQuery({
    queryKey: ['holiday-cn', year],
    queryFn: () => loadHolidayCalendar([year, year + 1]),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
};
