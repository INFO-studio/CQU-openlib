import {
  createFileRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { AdminGate, AdminShell, unlockWithKey } from '~/admin/AdminShell';
import { AdminSessionProvider } from '~/admin/lib/adminSession';
import { fetchSubmissions } from '~/admin/lib/api';
import {
  ADMIN_MODULES,
  clearAdminKey,
  readAdminKey,
} from '~/admin/lib/session';

/** Longest matching path wins, so /admin/emails beats the /admin index. */
const activeModuleId = (pathname: string): string =>
  [...ADMIN_MODULES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((mod) => pathname === mod.path || pathname.startsWith(`${mod.path}/`))
    ?.id ?? 'submissions';

/**
 * Layout for every maintainer module: one gate, one key, one lock button.
 * Modules mount inside the shell and read the session from context.
 */
const AdminLayout = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unlocked, setUnlocked] = useState(() => Boolean(readAdminKey()));
  const [refreshToken, setRefreshToken] = useState(0);

  const lock = useCallback(() => {
    clearAdminKey();
    setUnlocked(false);
  }, []);

  const onUnlock = useCallback(async (key: string) => {
    const err = await unlockWithKey(key, async (k) => {
      const res = await fetchSubmissions({ key: k });
      return { ok: Boolean(res.success), message: res.message };
    });
    if (!err) {
      setUnlocked(true);
      setRefreshToken((n) => n + 1);
    }
    return err;
  }, []);

  const session = useMemo(
    () => ({ refreshToken, onUnauthorized: lock }),
    [refreshToken, lock],
  );

  return (
    <AdminShell
      unlocked={unlocked}
      onLock={lock}
      activeModuleId={activeModuleId(pathname)}
    >
      {unlocked ? (
        <AdminSessionProvider value={session}>
          <Outlet />
        </AdminSessionProvider>
      ) : (
        <AdminGate onUnlock={onUnlock} />
      )}
    </AdminShell>
  );
};

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});
