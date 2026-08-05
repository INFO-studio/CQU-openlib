import { adminFetch } from '~/admin/lib/adminFetch';

export type AnalyticsRange = '7d' | '30d';

export const ANALYTICS_RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: '7d', label: '近 7 天' },
  { id: '30d', label: '近 30 天' },
];

export type DailyPoint = { date: string; views: number; sessions: number };

export type Overview = {
  views: number;
  sessions: number;
  events: number;
  viewsPerSession: number;
  bounceRate: number;
};

export type PageRow = { path: string; views: number; sessions: number };
export type CountRow = { path: string; count: number };
export type FlowRow = { from: string; to: string; count: number };
export type ClickRow = { itemType: string; count: number };
export type DownloadRow = {
  ref: string;
  kind: string;
  text: string;
  page: string;
  count: number;
};
export type SearchRow = {
  query: string;
  count: number;
  results: number;
  selected: number;
};
export type DeadSearchRow = { query: string; count: number };
export type ErrorRow = {
  path: string;
  reason: string;
  from: string;
  count: number;
  lastAt: string | null;
};
export type TotalRow = { path: string; count: number; lastAt: string | null };

export type AnalyticsData = {
  range: AnalyticsRange;
  since: string;
  overview: Overview;
  daily: DailyPoint[];
  topPages: PageRow[];
  entryPages: CountRow[];
  flows: FlowRow[];
  clicks: ClickRow[];
  downloads: DownloadRow[];
  searches: SearchRow[];
  deadSearches: DeadSearchRow[];
  errors: ErrorRow[];
  allTime: TotalRow[];
};

export type AnalyticsResponse = {
  success: boolean;
  message?: string;
} & Partial<AnalyticsData>;

export const EMPTY_ANALYTICS: AnalyticsData = {
  range: '7d',
  since: '',
  overview: {
    views: 0,
    sessions: 0,
    events: 0,
    viewsPerSession: 0,
    bounceRate: 0,
  },
  daily: [],
  topPages: [],
  entryPages: [],
  flows: [],
  clicks: [],
  downloads: [],
  searches: [],
  deadSearches: [],
  errors: [],
  allTime: [],
};

/** Named so a missing panel renders as empty rather than crashing the page. */
export const mapAnalytics = (
  raw: Partial<AnalyticsData>,
  range: AnalyticsRange,
): AnalyticsData => ({
  range,
  since: raw.since ?? '',
  overview: raw.overview ?? EMPTY_ANALYTICS.overview,
  daily: raw.daily ?? [],
  topPages: raw.topPages ?? [],
  entryPages: raw.entryPages ?? [],
  flows: raw.flows ?? [],
  clicks: raw.clicks ?? [],
  downloads: raw.downloads ?? [],
  searches: raw.searches ?? [],
  deadSearches: raw.deadSearches ?? [],
  errors: raw.errors ?? [],
  allTime: raw.allTime ?? [],
});

export const fetchAnalytics = async (
  range: AnalyticsRange,
): Promise<AnalyticsResponse> =>
  adminFetch<Partial<AnalyticsData>>(`/admin/analytics?range=${range}`);

const CLICK_LABELS: Record<string, string> = {
  download: '下载',
  code_copy: '复制代码',
  content_tab: '内容页签',
  collapse: '折叠块',
};

export const clickLabel = (itemType: string): string =>
  CLICK_LABELS[itemType] ?? itemType;

const DOWNLOAD_KIND_LABELS: Record<string, string> = {
  file: '网盘直链',
  asset: '站内文件',
  ext: '站外文件',
};

export const downloadKindLabel = (kind: string): string =>
  DOWNLOAD_KIND_LABELS[kind] ?? kind;

const ERROR_REASON_LABELS: Record<string, string> = {
  not_found: '页面不存在',
  fetch_error: '加载失败',
};

export const errorReasonLabel = (reason: string): string =>
  ERROR_REASON_LABELS[reason] ?? reason;
