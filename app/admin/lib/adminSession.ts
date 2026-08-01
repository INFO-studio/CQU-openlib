import { createContext, useContext } from 'react';

/** What the /admin layout hands down to whichever module is mounted. */
export type AdminSession = {
  /** Bumps when the shell unlocks, so modules refetch. */
  refreshToken: number;
  /** A module hit 401 — drop the key and fall back to the gate. */
  onUnauthorized: () => void;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

export const AdminSessionProvider = AdminSessionContext.Provider;

export const useAdminSession = (): AdminSession => {
  const session = useContext(AdminSessionContext);
  if (!session) {
    throw new Error('useAdminSession must be used inside the /admin layout');
  }
  return session;
};
