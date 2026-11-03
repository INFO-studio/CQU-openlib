import {
  createFileRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminGate, AdminShell } from '~/admin/AdminShell';
import { adminFetch } from '~/admin/lib/adminFetch';
import { AdminSessionProvider } from '~/admin/lib/adminSession';
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
 * Layout for every maintainer module: one gate, one session, one lock button.
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

  useEffect(() => {
    if (!readAdminKey()) return;
    const gate = { cancelled: false };
    void adminFetch('/admin/session').then((res) => {
      if (gate.cancelled || res.success) return;
      if (res.message === 'unauthorized') setUnlocked(false);
    });
    return () => {
      gate.cancelled = true;
    };
  }, []);

  const onEntered = useCallback(() => {
    setUnlocked(true);
    setRefreshToken((n) => n + 1);
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
        <AdminGate onEntered={onEntered} />
      )}
    </AdminShell>
  );
};

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});
