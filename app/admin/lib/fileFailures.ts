import { adminFetch } from '~/admin/lib/adminFetch';

export type FileFailureSummary = {
  site24h: number;
  total30d: number;
  affectedKeys30d: number;
  alertThreshold: number;
};

export type FileFailureKey = {
  key: string;
  count: number;
  lastAt: string;
};

export type FileFailureItem = {
  id: string;
  key: string;
  reason: string;
  at: string;
};

export type FileFailuresResponse = {
  success: boolean;
  summary?: FileFailureSummary;
  keys?: FileFailureKey[];
  items?: FileFailureItem[];
  message?: string;
};

export const fetchFileFailures = (): Promise<FileFailuresResponse> =>
  adminFetch<{
    summary?: FileFailureSummary;
    keys?: FileFailureKey[];
    items?: FileFailureItem[];
  }>('/admin/file-failures');
