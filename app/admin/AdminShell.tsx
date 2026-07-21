import { Link } from '@tanstack/react-router';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { ADMIN_MODULES, clearAdminKey, writeAdminKey } from '~/admin/lib/session';

type ShellProps = {
  children: ReactNode;
  unlocked: boolean;
  onLock: () => void;
  activeModuleId?: string;
};

/** Independent admin chrome — not DocsShell. */
export const AdminShell = ({
  children,
  unlocked,
  onLock,
  activeModuleId = 'submissions',
}: ShellProps) => (
  <div className="admin-root">
    <header className="admin-top">
      <div className="admin-top__brand">
        <span className="admin-top__mark" aria-hidden="true" />
        <div>
          <p className="admin-top__title">openlib 维护台</p>
          <p className="admin-top__sub">不与主站共用布局</p>
        </div>
      </div>
      {unlocked ? (
        <nav className="admin-nav" aria-label="维护模块">
          {ADMIN_MODULES.map((mod) => (
            <Link
              key={mod.id}
              to={mod.path as '/admin'}
              className={
                mod.id === activeModuleId
                  ? 'admin-nav__item is-active'
                  : 'admin-nav__item'
              }
            >
              {mod.label}
            </Link>
          ))}
          <button type="button" className="admin-nav__lock" onClick={onLock}>
            锁定
          </button>
        </nav>
      ) : null}
    </header>
    <main className="admin-main">{children}</main>
  </div>
);

type GateProps = {
  onUnlock: (key: string) => Promise<string | null>;
};

export const AdminGate = ({ onUnlock }: GateProps) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const message = await onUnlock(key.trim());
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-gate">
      <form className="admin-gate__card" onSubmit={onSubmit}>
        <p className="admin-gate__eyebrow">通行校验</p>
        <h1 className="admin-gate__title">输入维护密钥</h1>
        <p className="admin-gate__lede">
          校验通过后，本会话可查看收集结果。
        </p>
        <label className="admin-gate__label" htmlFor="admin-key">
          Admin Key
        </label>
        <input
          id="admin-key"
          className="admin-gate__input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(ev) => setKey(ev.target.value)}
          placeholder="粘贴密钥"
        />
        {error ? <p className="admin-gate__error">{error}</p> : null}
        <button
          type="submit"
          className="admin-gate__submit"
          disabled={busy || !key.trim()}
        >
          {busy ? '校验中…' : '进入'}
        </button>
      </form>
    </div>
  );
};

export const unlockWithKey = async (
  key: string,
  probe: (key: string) => Promise<{ ok: boolean; message?: string }>,
): Promise<string | null> => {
  const result = await probe(key);
  if (!result.ok) {
    clearAdminKey();
    return result.message === 'unauthorized'
      ? '密钥不正确'
      : result.message || '无法进入';
  }
  writeAdminKey(key);
  return null;
};
