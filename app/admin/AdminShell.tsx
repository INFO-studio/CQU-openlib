import { Link } from '@tanstack/react-router';
import { Inbox, Lock, type LucideIcon, Mail } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import {
  ADMIN_MODULES,
  clearAdminKey,
  writeAdminKey,
} from '~/admin/lib/session';
import { cn } from '~/lib/cn';
import { colors } from '~/theme/colors';

/**
 * Maintainer console chrome — not DocsShell.
 *
 * Direction: a night filing desk. `theme-dark` pins the site's dark palette on
 * regardless of the reader's theme, so the console borrows the product's
 * colours instead of inventing its own.
 */
const SURFACE = 'theme-dark min-h-screen bg-paper font-sans text-ink';

const MODULE_ICONS: Record<string, LucideIcon> = {
  submissions: Inbox,
  emails: Mail,
};

type ShellProps = {
  children: ReactNode;
  unlocked: boolean;
  onLock: () => void;
  activeModuleId?: string;
};

export const AdminShell = ({
  children,
  unlocked,
  onLock,
  activeModuleId = 'submissions',
}: ShellProps) => {
  if (!unlocked) return <div className={SURFACE}>{children}</div>;

  return (
    <div className={cn(SURFACE, 'grid md:grid-cols-[15.5rem_minmax(0,1fr)]')}>
      <aside className="flex items-center gap-4 overflow-x-auto border-b border-line bg-panel px-4 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:gap-6 md:border-b-0 md:border-r md:px-3 md:py-5">
        <div className="flex shrink-0 items-center gap-2.5 md:px-1.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center"
            aria-hidden
          >
            <img
              src="/doc/assets/openlib-logo-dark.svg"
              alt=""
              width={28}
              height={28}
              className="h-full w-full object-contain"
            />
          </span>
          <div>
            <p className="m-0 font-display text-[1.02rem] font-semibold leading-tight">
              openlib 维护台
            </p>
            <p className="m-0 mt-0.5 hidden font-mono text-[0.66rem] uppercase tracking-[0.12em] text-icon md:block">
              console
            </p>
          </div>
        </div>

        <nav className="flex gap-1 md:flex-col" aria-label="维护模块">
          <p className="m-0 mb-1 hidden px-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-icon md:block">
            模块
          </p>
          {ADMIN_MODULES.map((mod) => {
            const Icon = MODULE_ICONS[mod.id] ?? Inbox;
            const active = mod.id === activeModuleId;
            return (
              <Link
                key={mod.id}
                to={mod.path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'grid grid-cols-[1.1rem_minmax(0,1fr)] items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 no-underline transition-colors md:whitespace-normal',
                  active
                    ? 'bg-primary-soft text-ink shadow-rail-active'
                    : 'text-muted hover:bg-mist hover:text-ink',
                )}
              >
                <Icon size={15} aria-hidden />
                <span>
                  <span className="text-[0.88rem] font-medium">
                    {mod.label}
                  </span>
                  <span className="mt-0.5 hidden text-[0.7rem] leading-snug text-icon md:block">
                    {mod.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onLock}
          className="ml-auto inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[0.83rem] text-muted transition-colors hover:bg-mist hover:text-ink md:ml-0 md:mt-auto md:w-full"
        >
          <Lock size={13} aria-hidden />
          锁定会话
        </button>
      </aside>

      <main className="min-w-0 px-4 pb-12 pt-4 md:px-7 md:pb-16 md:pt-6">
        {children}
      </main>
    </div>
  );
};

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
    <div
      className="grid min-h-screen place-items-center px-4 py-8"
      style={{
        backgroundImage: `radial-gradient(900px 480px at 50% -10%, ${colors.mist}, transparent 60%)`,
      }}
    >
      <form
        className="w-[min(25rem,100%)] rounded-2xl border border-line bg-panel p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
        onSubmit={onSubmit}
      >
        <p className="m-0 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-primary">
          通行校验
        </p>
        <h1 className="m-0 mt-2 font-display text-[1.55rem] font-semibold">
          输入维护密钥
        </h1>
        <p className="m-0 mt-2 text-[0.9rem] leading-relaxed text-muted">
          校验通过后，本会话可查看收集结果。
        </p>
        <label
          className="mt-5 block font-mono text-[0.72rem] tracking-wider text-icon"
          htmlFor="admin-key"
        >
          Admin Key
        </label>
        <input
          id="admin-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(ev) => setKey(ev.target.value)}
          placeholder="粘贴密钥"
          className="mt-1.5 block w-full rounded-lg border border-line bg-elev px-3 py-2.5 font-mono text-[0.9rem] transition-colors focus:border-primary"
        />
        {error ? <AdminError>{error}</AdminError> : null}
        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-paper transition-opacity disabled:opacity-50"
        >
          {busy ? '校验中…' : '进入'}
        </button>
      </form>
    </div>
  );
};

/** Failure states say what happened, in the console's voice. */
export const AdminError = ({ children }: { children: ReactNode }) => (
  <p className="m-0 mt-3 rounded-md bg-error-soft px-2.5 py-2 text-[0.84rem] text-error">
    {children}
  </p>
);

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
