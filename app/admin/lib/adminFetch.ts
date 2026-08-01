import { clearAdminKey, readAdminKey } from '~/admin/lib/session';
import { apiUrl } from '~/lib/apiBase';

export type AdminResult<T> = { success: boolean; message?: string } & T;

/**
 * The one contract every admin call shares: bearer key, 401 locks the session,
 * and anything else comes back as a plain result object.
 *
 * This never rejects, which is the point. Callers flip a `busy` flag before
 * awaiting and clear it after; a thrown error skips the clear and leaves the
 * button spinning forever. Netlify answers an unknown route with an HTML 404
 * page, so `res.json()` really does throw in practice.
 */
export const adminFetch = async <T>(
  path: string,
  init?: RequestInit & { key?: string },
): Promise<AdminResult<T> | { success: false; message: string }> => {
  const key = (init?.key ?? readAdminKey()).trim();
  if (!key) return { success: false, message: 'unauthorized' };

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${key}`,
      },
    });
  } catch {
    return { success: false, message: '连不上后端，检查网络后重试' };
  }

  if (res.status === 401) {
    clearAdminKey();
    return { success: false, message: 'unauthorized' };
  }

  const data = (await res.json().catch(() => null)) as AdminResult<T> | null;
  if (!res.ok || !data) {
    return {
      success: false,
      message: data?.message?.trim() || `请求失败（${res.status}）`,
    };
  }
  return data;
};
