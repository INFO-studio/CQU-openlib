import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import '~/admin/admin.css';
import { AdminGate, AdminShell, unlockWithKey } from '~/admin/AdminShell';
import { fetchSubmissions } from '~/admin/lib/api';
import { clearAdminKey, readAdminKey } from '~/admin/lib/session';
import { SubmissionsPage } from '~/admin/modules/submissions/SubmissionsPage';

const AdminPage = () => {
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

  return (
    <AdminShell
      unlocked={unlocked}
      onLock={onLock}
      activeModuleId="submissions"
    >
      {unlocked ? (
        <SubmissionsPage
          refreshToken={refreshToken}
          onUnauthorized={onUnauthorized}
        />
      ) : (
        <AdminGate onUnlock={onUnlock} />
      )}
    </AdminShell>
  );
};

export const Route = createFileRoute('/admin')({
  component: AdminPage,
});
