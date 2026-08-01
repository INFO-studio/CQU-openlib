import { adminFetch } from '~/admin/lib/adminFetch';
import {
  DEFAULT_SUBMISSION_STATUS,
  normalizeStatus,
  type SubmissionStatus,
} from '~/admin/lib/status';

export type FormType = 'feedback' | 'textbook' | 'upload' | 'club' | 'group';

export type SubmissionItem = {
  id: string;
  type: FormType | string;
  payload: Record<string, unknown>;
  ua: string | null;
  ipHash: string | null;
  createdAt: string;
  status: SubmissionStatus;
  completionNote: string | null;
  completedAt: string | null;
};

export type SubmissionsResponse = {
  success: boolean;
  count?: number;
  items?: SubmissionItem[];
  message?: string;
};

export type StatusTransitionResponse = {
  success: boolean;
  item?: SubmissionItem;
  message?: string;
};

const mapItem = (
  raw: Partial<SubmissionItem> & { id: string },
): SubmissionItem => ({
  id: raw.id,
  type: raw.type ?? '',
  payload: (raw.payload ?? {}) as Record<string, unknown>,
  ua: raw.ua ?? null,
  ipHash: raw.ipHash ?? null,
  createdAt:
    typeof raw.createdAt === 'string'
      ? raw.createdAt
      : String(raw.createdAt ?? ''),
  status: normalizeStatus(raw.status ?? DEFAULT_SUBMISSION_STATUS),
  completionNote:
    typeof raw.completionNote === 'string' ? raw.completionNote : null,
  completedAt:
    raw.completedAt == null
      ? null
      : typeof raw.completedAt === 'string'
        ? raw.completedAt
        : String(raw.completedAt),
});

export const fetchSubmissions = async (opts?: {
  type?: FormType | '';
  status?: SubmissionStatus | '';
  key?: string;
}): Promise<SubmissionsResponse> => {
  const params = new URLSearchParams();
  if (opts?.type) params.set('type', opts.type);
  if (opts?.status) params.set('status', opts.status);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const data = await adminFetch<{
    count?: number;
    items?: SubmissionItem[];
  }>(`/admin/submissions${qs}`, { key: opts?.key });

  if (!data.success) return data;
  return {
    ...data,
    items: (data.items ?? []).map((item) => mapItem(item)),
  };
};

export const transitionSubmissionStatus = async (opts: {
  id: string;
  status: SubmissionStatus;
  completionNote?: string;
  key?: string;
}): Promise<StatusTransitionResponse> => {
  const body: Record<string, string> = {
    id: opts.id,
    status: opts.status,
  };
  if (opts.completionNote !== undefined) {
    body.completionNote = opts.completionNote;
  }

  const data = await adminFetch<{ item?: SubmissionItem }>(
    '/admin/submissions/status',
    {
      method: 'POST',
      key: opts.key,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!data.success) return data;
  return {
    success: true,
    item: data.item ? mapItem(data.item) : undefined,
  };
};
