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

export type FileFailureArchive = {
  total: number;
  keys: FileFailureKey[];
};

export type FileFailuresResponse = {
  success: boolean;
  summary?: FileFailureSummary;
  keys?: FileFailureKey[];
  items?: FileFailureItem[];
  archive?: FileFailureArchive;
  message?: string;
};

export const fetchFileFailures = (): Promise<FileFailuresResponse> =>
  adminFetch<{
    summary?: FileFailureSummary;
    keys?: FileFailureKey[];
    items?: FileFailureItem[];
    archive?: FileFailureArchive;
  }>('/admin/file-failures');

const postAction = <T>(body: Record<string, string>) =>
  adminFetch<T>('/admin/file-failures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const archiveFileFailures = () =>
  postAction<{ archived?: number }>({ action: 'archive' });

export const purgeFileFailureKey = (key: string) =>
  postAction<{ removed?: { current: number; archive: number } }>({
    action: 'purge',
    key,
  });
