import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { loadHolidayCalendar } from '~/components/doc/BusTimeTable/holidays';

afterEach(() => vi.unstubAllGlobals());

describe('holiday-cn loader', () => {
  it('merges available years and records missing years', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input.includes('/2026.json')
          ? new Response(
              JSON.stringify({
                year: 2026,
                papers: [
                  'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm',
                ],
                days: [
                  { date: '2026-09-20', isOffDay: false },
                  { date: '2026-09-26', isOffDay: true },
                ],
              }),
              { status: 200 },
            )
          : new Response('', { status: 404 }),
      ),
    );

    await expect(loadHolidayCalendar([2026, 2027])).resolves.toEqual({
      calendar: {
        '2026-09-20': false,
        '2026-09-26': true,
      },
      missingYears: [2027],
    });
  });

  it('lets the next-year file override dates from the previous December', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const year = input.includes('/2027.json') ? 2027 : 2026;
        return new Response(
          JSON.stringify({
            year,
            papers: ['https://www.gov.cn/example'],
            days: [
              {
                date: '2026-12-31',
                isOffDay: year === 2027,
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    await expect(loadHolidayCalendar([2026, 2027])).resolves.toMatchObject({
      calendar: { '2026-12-31': true },
      missingYears: [],
    });
  });

  it('fails when no requested year is available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    await expect(loadHolidayCalendar([2026, 2027])).rejects.toThrow(
      'holiday-cn unavailable',
    );
  });
});
