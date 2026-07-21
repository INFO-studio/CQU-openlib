import { createFileRoute, Outlet } from '@tanstack/react-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import '~/admin/admin.css';
import { AdminGate, AdminShell, unlockWithKey } from '~/admin/AdminShell';
import { fetchSubmissions } from '~/admin/lib/api';
import { clearAdminKey, readAdminKey } from '~/admin/lib/session';

export type AdminOutletContext = {
  refreshToken: number;
  onUnauthorized: () => void;
};

const AdminCtx = createContext<AdminOutletContext | null>(null);

export const useAdminContext = (): AdminOutletContext => {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAdminContext outside /admin');
  return ctx;
};

const AdminLayout = () => {
  const [unlocked, setUnlocked] = useState(() => Boolean(readAdminKey()));
  const [refreshToken, setRefreshToken] = useState(0);

  const onLock = useCallback(() => {
    clearAdminKey();
    setUnlocked(false);
  }, []);

  const onUnauthorized = useCallback(() => {
    clearAdminKey();
    setUnlocked(false);
  }, []);

  const onUnlock = useCallback(async (key: string) => {
    const err = await unlockWithKey(key, async (k) => {
      const res = await fetchSubmissions({ key: k });
      return {
        ok: Boolean(res.success),
        message: res.message,
      };
    });
    if (!err) {
      setUnlocked(true);
      setRefreshToken((n) => n + 1);
    }
    return err;
  }, []);

  const value = useMemo(
    () => ({ refreshToken, onUnauthorized }),
    [refreshToken, onUnauthorized],
  );

  return (
    <AdminShell
      unlocked={unlocked}
      onLock={onLock}
      activeModuleId="submissions"
    >
      {unlocked ? (
        <AdminCtx.Provider value={value}>
          <Outlet />
        </AdminCtx.Provider>
      ) : (
        <AdminGate onUnlock={onUnlock} />
      )}
    </AdminShell>
  );
};

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});
