import { apiUrl } from '~/lib/apiBase';
import { clearAdminKey, readAdminKey } from '~/admin/lib/session';

export type FormType = 'feedback' | 'textbook' | 'upload' | 'club';

export type SubmissionItem = {
  id: string;
  type: FormType | string;
  payload: Record<string, unknown>;
  ua: string | null;
  ipHash: string | null;
  createdAt: string;
};

export type SubmissionsResponse = {
  success: boolean;
  count?: number;
  items?: SubmissionItem[];
  message?: string;
};

export const fetchSubmissions = async (opts?: {
  type?: FormType | '';
  key?: string;
}): Promise<SubmissionsResponse> => {
  const key = (opts?.key ?? readAdminKey()).trim();
  if (!key) {
    return { success: false, message: 'unauthorized' };
  }

  const qs = opts?.type ? `?type=${encodeURIComponent(opts.type)}` : '';
  const res = await fetch(apiUrl(`/admin/submissions${qs}`), {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (res.status === 401) {
    clearAdminKey();
    return { success: false, message: 'unauthorized' };
  }

  const data = (await res.json()) as SubmissionsResponse;
  if (!res.ok) {
    return {
      success: false,
      message: data.message?.trim() || `请求失败（${res.status}）`,
    };
  }
  return data;
};
