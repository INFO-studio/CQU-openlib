export type BusService =
  | 'daily'
  | 'exceptSunday'
  | 'weekendAndHolidays'
  | 'weekdayOnly';

export type BusEndpointId = 'shapingba' | 'science' | 'engineer' | 'transient';

export type BusMapTarget = {
  campus: 'a' | 'b' | 'c' | 'd' | 'e';
  focus: string;
};

export type BusStopTime = {
  stop: string;
  time: string;
  map?: BusMapTarget;
};

export type BusTrip = {
  id: string;
  stops: BusStopTime[];
  service: BusService;
};

export type BusDirection = {
  id: string;
  fromId: BusEndpointId;
  toId: BusEndpointId;
  from: string;
  to: string;
  label: string;
  routeNote?: string;
  trips: BusTrip[];
};

export type BusEndpoint = {
  id: BusEndpointId;
  label: string;
};

export type BusEndpointSide = 'from' | 'to';

export type BusSelection = {
  fromId: BusEndpointId | null;
  toId: BusEndpointId | null;
};

export type ShanghaiClock = {
  dateKey: string;
  dayOfWeek: number;
  minutes: number;
};

export type UpcomingBus = {
  trip: BusTrip;
  dayOffset: number;
  minutesUntil: number;
};

type BusStopDefinition = Omit<BusStopTime, 'time'>;
export type HolidayCalendar = Readonly<Record<string, boolean>>;

const SHANGHAI_TIME_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DAY_MS = 86_400_000;

const dateKeyAfter = (dateKey: string, dayOffset: number): string =>
  new Date(Date.parse(`${dateKey}T00:00:00Z`) + dayOffset * DAY_MS)
    .toISOString()
    .slice(0, 10);
const minutesOf = (time: string): number => {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const tripsFromRows = (
  stops: BusStopDefinition[],
  rows: string[][],
  services: Record<number, BusService> = {},
): BusTrip[] =>
  rows.map((times, index) => ({
    id: String(index + 1),
    service: services[index + 1] ?? 'daily',
    stops: times.map((time, stopIndex) => ({
      ...stops[stopIndex]!,
      time,
    })),
  }));

const shapingbaToScience = tripsFromRows(
  [
    { stop: 'A 校园后门', map: { campus: 'a', focus: 'a_bus_station_01' } },
    { stop: 'A 校园钟塔', map: { campus: 'a', focus: 'a_bus_station_02' } },
    { stop: 'B 校园主席像' },
    { stop: 'C 校园大门', map: { campus: 'c', focus: 'c_carstop_01' } },
  ],
  [
    ['07:20', '07:25', '07:25', '07:35'],
    ['07:40', '07:45', '07:50', '08:00'],
    ['08:10', '08:15', '08:20', '08:30'],
    ['09:10', '09:15', '09:20', '09:30'],
    ['10:30', '10:35', '10:40', '10:50'],
    ['11:30', '11:35', '11:40', '11:50'],
    ['12:20', '12:25', '12:30', '12:40'],
    ['13:10', '13:15', '13:20', '13:30'],
    ['14:00', '14:05', '14:10', '14:20'],
    ['14:45', '14:50', '14:55', '15:05'],
    ['15:20', '15:25', '15:30', '15:40'],
    ['16:20', '16:25', '16:30', '16:40'],
    ['17:20', '17:25', '17:30', '17:40'],
    ['17:50', '17:55', '18:00', '18:10'],
    ['18:20', '18:25', '18:30', '18:40'],
    ['19:30', '19:35', '19:40', '19:50'],
    ['20:30', '20:35', '20:40', '20:50'],
    ['21:00', '21:05', '21:10', '21:20'],
    ['21:50', '21:55', '22:00', '22:10'],
  ],
  { 1: 'exceptSunday', 2: 'exceptSunday' },
);

const scienceToShapingba = tripsFromRows(
  [
    {
      stop: '科学中心（虎溪花园北）',
      map: { campus: 'd', focus: 'huxi_admin_01' },
    },
    {
      stop: '虎溪花园南',
      map: { campus: 'd', focus: 'huxi_carstop_03' },
    },
    { stop: '理科楼', map: { campus: 'd', focus: 'huxi_carstop_02' } },
    {
      stop: '虎溪校园乘车站',
      map: { campus: 'd', focus: 'huxi_carstop_01' },
    },
  ],
  [
    ['07:10', '07:12', '07:15', '07:20'],
    ['07:40', '07:42', '07:45', '07:50'],
    ['08:10', '08:12', '08:15', '08:20'],
    ['09:10', '09:12', '09:15', '09:20'],
    ['10:20', '10:22', '10:25', '10:30'],
    ['11:20', '11:22', '11:25', '11:30'],
    ['12:10', '12:12', '12:15', '12:20'],
    ['12:50', '12:52', '12:55', '13:00'],
    ['13:50', '13:52', '13:55', '14:00'],
    ['14:35', '14:37', '14:40', '14:45'],
    ['15:20', '15:22', '15:25', '15:30'],
    ['16:10', '16:12', '16:15', '16:20'],
    ['17:15', '17:17', '17:20', '17:25'],
    ['17:40', '17:42', '17:45', '17:50'],
    ['18:10', '18:12', '18:15', '18:20'],
    ['19:35', '19:37', '19:40', '19:45'],
    ['20:20', '20:22', '20:25', '20:30'],
    ['20:50', '20:52', '20:55', '21:00'],
    ['21:40', '21:42', '21:45', '21:50'],
  ],
  { 1: 'exceptSunday', 2: 'exceptSunday' },
);

const huxiToTransient = tripsFromRows(
  [
    {
      stop: '虎溪校园乘车站',
      map: { campus: 'd', focus: 'huxi_carstop_01' },
    },
    { stop: '理科楼', map: { campus: 'd', focus: 'huxi_carstop_02' } },
  ],
  [
    ['08:30', '08:32'],
    ['09:10', '09:12'],
    ['14:10', '14:12'],
    ['17:00', '17:02'],
    ['18:40', '18:42'],
  ],
  { 2: 'weekendAndHolidays', 3: 'weekendAndHolidays' },
);

const transientToHuxi = tripsFromRows(
  [{ stop: '超瞬态实验室' }, { stop: '嘉陵江实验室' }],
  [
    ['08:50', '08:53'],
    ['11:30', '11:33'],
    ['14:40', '14:43'],
    ['17:30', '17:33'],
    ['21:10', '21:13'],
    ['22:20', '22:23'],
  ],
  {
    2: 'weekendAndHolidays',
    3: 'weekendAndHolidays',
    5: 'weekendAndHolidays',
  },
);

const scienceToEngineer = tripsFromRows(
  [
    {
      stop: '虎溪花园北（科学中心）',
      map: { campus: 'd', focus: 'huxi_admin_01' },
    },
    {
      stop: '虎溪校园乘车站',
      map: { campus: 'd', focus: 'huxi_carstop_01' },
    },
  ],
  [
    ['07:05', '07:10'],
    ['15:55', '16:00'],
  ],
  { 1: 'weekdayOnly', 2: 'weekdayOnly' },
);

const engineerToScience = tripsFromRows(
  [{ stop: '国家卓越工程师学院' }],
  [['08:40'], ['17:30']],
  { 1: 'weekdayOnly', 2: 'weekdayOnly' },
);

const campusAToEngineer = tripsFromRows(
  [{ stop: 'A 校园钟塔', map: { campus: 'a', focus: 'a_bus_station_02' } }],
  [['07:10'], ['16:00']],
  { 1: 'weekdayOnly', 2: 'weekdayOnly' },
);

const engineerToCampusA = tripsFromRows(
  [{ stop: '国家卓越工程师学院' }],
  [['08:40'], ['17:30']],
  { 1: 'weekdayOnly', 2: 'weekdayOnly' },
);

export const busDirections: BusDirection[] = [
  {
    id: 'shapingba-to-science',
    fromId: 'shapingba',
    toId: 'science',
    from: '沙坪坝校区',
    to: '科学城校区',
    label: '沙坪坝 → 科学城',
    routeNote: '07:20、07:40 班次周日及法定节假日不运行',
    trips: shapingbaToScience,
  },
  {
    id: 'science-to-shapingba',
    fromId: 'science',
    toId: 'shapingba',
    from: '科学城校区',
    to: '沙坪坝校区',
    label: '科学城 → 沙坪坝',
    routeNote:
      '17:15、17:40 班次停靠综合楼十字路口站；07:10、07:40 班次周日及法定节假日不运行',
    trips: scienceToShapingba,
  },
  {
    id: 'huxi-to-transient',
    fromId: 'science',
    toId: 'transient',
    from: '虎溪校园',
    to: '超瞬态实验室',
    label: '虎溪 → 超瞬态',
    routeNote: '经嘉陵江实验室前往超瞬态实验室',
    trips: huxiToTransient,
  },
  {
    id: 'transient-to-huxi',
    fromId: 'transient',
    toId: 'science',
    from: '超瞬态实验室',
    to: '虎溪校园',
    label: '超瞬态 → 虎溪',
    routeNote: '经嘉陵江实验室返回虎溪校园',
    trips: transientToHuxi,
  },
  {
    id: 'science-to-engineer',
    fromId: 'science',
    toId: 'engineer',
    from: '科学城校区',
    to: '国家卓越工程师学院',
    label: '科学城 → 卓越工程师学院',
    routeNote: '由虎溪花园北发车，经虎溪校园乘车站前往',
    trips: scienceToEngineer,
  },
  {
    id: 'engineer-to-science',
    fromId: 'engineer',
    toId: 'science',
    from: '国家卓越工程师学院',
    to: '科学城校区',
    label: '卓越工程师学院 → 科学城',
    trips: engineerToScience,
  },
  {
    id: 'campus-a-to-engineer',
    fromId: 'shapingba',
    toId: 'engineer',
    from: 'A 校园',
    to: '国家卓越工程师学院',
    label: 'A 校园 → 卓越工程师学院',
    trips: campusAToEngineer,
  },
  {
    id: 'engineer-to-campus-a',
    fromId: 'engineer',
    toId: 'shapingba',
    from: '国家卓越工程师学院',
    to: 'A 校园',
    label: '卓越工程师学院 → A 校园',
    trips: engineerToCampusA,
  },
];

export const busEndpoints: BusEndpoint[] = [
  { id: 'shapingba', label: '沙坪坝校区' },
  { id: 'science', label: '科学城校区' },
  { id: 'engineer', label: '卓越工程师学院' },
  { id: 'transient', label: '超瞬态实验室' },
];

export const directionFor = (
  fromId: BusEndpointId | null,
  toId: BusEndpointId | null,
): BusDirection | null =>
  busDirections.find(
    (direction) => direction.fromId === fromId && direction.toId === toId,
  ) ?? null;

export const selectBusEndpoint = (
  selection: BusSelection,
  side: BusEndpointSide,
  value: BusEndpointId,
): BusSelection => {
  if (side === 'from') {
    return {
      fromId: value,
      toId: directionFor(value, selection.toId) ? selection.toId : null,
    };
  }
  return {
    fromId: directionFor(selection.fromId, value) ? selection.fromId : null,
    toId: value,
  };
};

export const getShanghaiClock = (date: Date): ShanghaiClock => {
  const parts = Object.fromEntries(
    SHANGHAI_TIME_FORMAT.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );
  const year = parts.year ?? 1970;
  const month = parts.month ?? 1;
  const day = parts.day ?? 1;
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;

  return {
    dateKey: [year, month, day]
      .map((part, index) =>
        index === 0 ? String(part) : String(part).padStart(2, '0'),
      )
      .join('-'),
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    minutes: hour * 60 + minute + second / 60,
  };
};

export const serviceRunsOnDay = (
  service: BusService,
  dayOfWeek: number,
  isHoliday = false,
): boolean => {
  if (service === 'exceptSunday') return dayOfWeek !== 0 && !isHoliday;
  if (service === 'weekendAndHolidays') {
    return dayOfWeek === 0 || dayOfWeek === 6 || isHoliday;
  }
  if (service === 'weekdayOnly') {
    return dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday;
  }
  return true;
};

export const findUpcomingBuses = (
  direction: BusDirection,
  clock: ShanghaiClock,
  holidays: HolidayCalendar,
  stopIndex = 0,
  limit = 2,
): UpcomingBus[] =>
  Array.from({ length: 8 }, (_, dayOffset) => dayOffset)
    .flatMap((dayOffset) => {
      const dateKey = dateKeyAfter(clock.dateKey, dayOffset);
      const dayOfWeek = (clock.dayOfWeek + dayOffset) % 7;
      return direction.trips
        .filter((trip) =>
          serviceRunsOnDay(trip.service, dayOfWeek, holidays[dateKey] === true),
        )
        .flatMap((trip) => {
          const stop = trip.stops[stopIndex];
          return stop
            ? [
                {
                  trip,
                  dayOffset,
                  minutesUntil:
                    dayOffset * 24 * 60 + minutesOf(stop.time) - clock.minutes,
                },
              ]
            : [];
        });
    })
    .filter(({ minutesUntil }) => minutesUntil >= 0)
    .sort((left, right) => left.minutesUntil - right.minutesUntil)
    .slice(0, limit);

export const upcomingBusesToShow = (upcoming: UpcomingBus[]): UpcomingBus[] =>
  upcoming.slice(
    0,
    (upcoming[0]?.minutesUntil ?? Number.POSITIVE_INFINITY) <= 15 ? 2 : 1,
  );

export const findRecentDeparture = (
  direction: BusDirection,
  clock: ShanghaiClock,
  holidays: HolidayCalendar,
  stopIndex = 0,
  thresholdMinutes = 5,
): UpcomingBus | null => {
  const isHoliday = holidays[clock.dateKey] === true;
  return (
    direction.trips
      .filter((trip) =>
        serviceRunsOnDay(trip.service, clock.dayOfWeek, isHoliday),
      )
      .flatMap((trip) => {
        const stop = trip.stops[stopIndex];
        if (!stop) return [];
        return [
          {
            trip,
            dayOffset: 0,
            minutesUntil: minutesOf(stop.time) - clock.minutes,
          },
        ];
      })
      .filter(
        ({ minutesUntil }) =>
          minutesUntil < 0 && minutesUntil >= -thresholdMinutes,
      )
      .sort((left, right) => right.minutesUntil - left.minutesUntil)[0] ?? null
  );
};

export const formatBusDay = (dayOffset: number, dayOfWeek: number): string => {
  if (dayOffset === 0) return '今天';
  if (dayOffset === 1) return '明天';
  return WEEKDAYS[(dayOfWeek + dayOffset) % 7] ?? '';
};

export const busServiceLabel = (service: BusService): string | null => {
  if (service === 'exceptSunday') return '周日及节假日停运';
  if (service === 'weekendAndHolidays') return '周末及节假日';
  if (service === 'weekdayOnly') return '工作日';
  return null;
};
