import { Dialog } from '@base-ui/react/dialog';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  CircleHelp,
  Copy,
  Inbox,
  Lock,
  type LucideIcon,
  Mail,
  X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { match } from 'ts-pattern';
import { adminPublic } from '~/admin/lib/adminFetch';
import {
  canonicalGroupCode,
  canonicalLocalCode,
  randomLocalCode,
} from '~/admin/lib/codes';
import {
  ADMIN_MODULES,
  readLocalCode,
  writeLocalCode,
  writeSession,
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
  'file-failures': Activity,
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
      {/* Phone: one sticky row of equal tabs. All destinations fit without a
          drawer; every child is `shrink-0` or `min-w-0` so labels do not
          squeeze into each other before the row needs to scroll. */}
      <aside className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-panel px-3 py-2 md:h-screen md:flex-col md:items-stretch md:gap-6 md:border-b-0 md:border-r md:px-3 md:py-5">
        <div className="flex shrink-0 items-center gap-2.5 md:px-1.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center"
            aria-hidden
          >
            <img
              src="/assets/logo/openlib-logo-dark.svg"
              alt=""
              width={28}
              height={28}
              className="h-full w-full object-contain"
            />
          </span>
          <div className="hidden md:block">
            <p className="m-0 font-display text-[1.02rem] font-semibold leading-tight">
              openlib 维护台
            </p>
            <p className="m-0 mt-0.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-icon">
              console
            </p>
          </div>
        </div>

        <nav
          className="flex min-w-0 flex-1 gap-1 md:flex-none md:flex-col"
          aria-label="维护模块"
        >
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
                  'flex min-w-0 flex-1 items-center justify-center rounded-lg px-1.5 py-1.5 no-underline transition-colors',
                  'md:grid md:flex-none md:grid-cols-[1.1rem_minmax(0,1fr)] md:justify-start md:gap-2.5 md:px-2.5 md:py-2',
                  active
                    ? 'bg-primary-soft text-ink shadow-rail-active'
                    : 'text-muted hover:bg-mist hover:text-ink',
                )}
              >
                <Icon
                  size={15}
                  className={cn(
                    'hidden md:block',
                    active ? 'text-icon-strong' : 'text-icon',
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate text-[0.82rem] font-medium md:text-[0.88rem]">
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
          aria-label="锁定会话"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-[0.83rem] text-muted transition-colors hover:bg-mist hover:text-ink md:mt-auto md:w-full md:px-3"
        >
          <Lock size={13} className="text-icon" aria-hidden />
          <span className="hidden md:inline">锁定会话</span>
        </button>
      </aside>

      <main className="min-w-0 px-4 pb-12 pt-4 md:px-7 md:pb-16 md:pt-6">
        {children}
      </main>
    </div>
  );
};

const LOCAL_COPY = '在本机永久保存；请牢记并在更换设备时自行复制；不应外泄';
const SHORT_COPY =
  '点击「绑定」按钮，在运行维护群 @ OpenElaina 发送「bind XXXXXX(短码)」';
const GROUP_COPY = '机器人回复的 4 位，与本地码一并提交';

const BIND_SPEC = [
  ['本地码', LOCAL_COPY],
  ['短码', SHORT_COPY],
  ['群码', GROUP_COPY],
] as const;

const RESTORE_SPEC = [
  ['本地码', LOCAL_COPY],
  ['群码', GROUP_COPY],
] as const;

const SpecList = ({
  items,
}: {
  items: readonly (readonly [string, string])[];
}) => (
  <dl className="m-0">
    {items.map(([term, detail]) => (
      <div key={term} className="border-t border-line py-2.5 first:border-t-0">
        <dt className="m-0 font-mono text-[0.72rem] tracking-wider text-icon">
          {term}
        </dt>
        <dd className="m-0 mt-1 text-[0.86rem] leading-relaxed text-ink">
          {detail}
        </dd>
      </div>
    ))}
  </dl>
);

const FlowHelp = () => (
  <Dialog.Root>
    <Dialog.Trigger
      type="button"
      aria-label="操作说明"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-icon outline-none transition-colors hover:bg-mist hover:text-icon-strong focus-visible:bg-mist"
    >
      <CircleHelp size={18} aria-hidden />
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-60 bg-backdrop" />
      <Dialog.Popup className="theme-dark fixed top-1/2 left-1/2 z-61 max-h-[calc(100vh-2rem)] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-panel p-4 text-ink shadow-2xl outline-none">
        <div className="flex items-center gap-2">
          <Dialog.Title className="m-0 flex-1 font-display text-lg font-semibold">
            操作说明
          </Dialog.Title>
          <Dialog.Close
            aria-label="关闭"
            className="grid h-8 w-8 place-items-center rounded-lg text-icon outline-none transition-colors hover:bg-mist hover:text-icon-strong"
          >
            <X size={16} aria-hidden />
          </Dialog.Close>
        </div>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="m-0 text-[0.95rem] font-semibold">
              绑定（第一次进入）
            </h2>
            <div className="mt-2">
              <SpecList items={BIND_SPEC} />
            </div>
          </section>
          <section>
            <h2 className="m-0 text-[0.95rem] font-semibold">
              复原（多设备登入）
            </h2>
            <div className="mt-2">
              <SpecList items={RESTORE_SPEC} />
            </div>
          </section>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);

const LABEL = 'mt-4 block font-mono text-[0.72rem] tracking-wider text-icon';
const INPUT =
  'mt-1.5 block w-full rounded-lg border border-line bg-elev px-3 py-2.5 font-mono text-[0.9rem] transition-colors focus:border-primary';

type GateStep =
  | { kind: 'choose' }
  | { kind: 'bind'; shortCode: string }
  | { kind: 'restore' }
  | { kind: 'group' };

type GateProps = {
  onEntered: () => void;
};

const storedLocalCode = () => canonicalLocalCode(readLocalCode()) ?? '';

export const AdminGate = ({ onEntered }: GateProps) => {
  const [local, setLocal] = useState(storedLocalCode);
  const [group, setGroup] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'enter' | 'bind' | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<GateStep>(
    storedLocalCode() ? { kind: 'group' } : { kind: 'choose' },
  );

  const copyLocal = async () => {
    const code = canonicalLocalCode(local);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('复制失败，请手动选中本地码');
    }
  };

  const startBind = async () => {
    if (busy) return;
    const localCode = randomLocalCode();
    setError(null);
    setBusy('bind');
    try {
      const res = await adminPublic<{ shortCode?: string }>('/admin/bind', {
        localCode,
      });
      if (!res.success || !res.shortCode) {
        setError(res.message || '绑定没有发出去');
        return;
      }
      writeLocalCode(localCode);
      setLocal(localCode);
      setStep({ kind: 'bind', shortCode: res.shortCode });
    } finally {
      setBusy(null);
    }
  };

  const confirmBind = async (shortCode: string) => {
    if (busy) return;
    const localCode = canonicalLocalCode(local);
    if (!localCode) return;
    setError(null);
    setBusy('bind');
    try {
      const res = await adminPublic<{ ready?: boolean }>('/admin/bind', {
        localCode,
        shortCode,
      });
      if (!res.success) {
        setError(res.message || '绑定尚未通过');
        return;
      }
      if (!res.ready) {
        setError('绑定尚未通过');
        return;
      }
      setStep({ kind: 'group' });
    } finally {
      setBusy(null);
    }
  };

  const leaveBind = () => {
    writeLocalCode('');
    setLocal('');
    setGroup('');
    setError(null);
    setStep({ kind: 'choose' });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const localCode = canonicalLocalCode(local);
    const groupCode = canonicalGroupCode(group);
    if (!localCode || !groupCode) {
      setError(localCode ? '账号或本地码不正确' : '本地码需要 8 位数字或字母');
      return;
    }
    setError(null);
    setBusy('enter');
    try {
      const res = await adminPublic<{ token?: string; expiresAt?: number }>(
        '/admin/session',
        { localCode, groupCode },
      );
      if (!res.success || !res.token || !res.expiresAt) {
        setError(res.message || '无法进入');
        return;
      }
      writeLocalCode(localCode);
      writeSession(res.token, res.expiresAt);
      onEntered();
    } finally {
      setBusy(null);
    }
  };

  const groupField = (
    <>
      <label className={LABEL} htmlFor="admin-group">
        群码
      </label>
      <input
        id="admin-group"
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={group}
        onChange={(ev) => setGroup(ev.target.value)}
        placeholder="请输入群码"
        className={INPUT}
      />
    </>
  );

  return (
    <div
      className="grid min-h-screen place-items-center px-4 py-8"
      style={{
        backgroundImage: `radial-gradient(900px 480px at 50% -10%, ${colors.mist}, transparent 60%)`,
      }}
    >
      <form
        className="w-[min(26rem,100%)] rounded-2xl border border-line bg-panel p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
        onSubmit={(event) => {
          if (step.kind !== 'restore' && step.kind !== 'group') {
            event.preventDefault();
            return;
          }
          void onSubmit(event);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="m-0 font-display text-[1.55rem] font-semibold">
            进入维护台
          </h1>
          <FlowHelp />
        </div>
        {match(step)
          .with({ kind: 'choose' }, () => (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void startBind()}
                disabled={Boolean(busy)}
                className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-paper transition-opacity disabled:opacity-50"
              >
                {busy === 'bind' ? '登记中…' : '绑定'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep({ kind: 'restore' });
                }}
                disabled={Boolean(busy)}
                className="rounded-lg border border-line px-4 py-2.5 text-[0.9rem] text-muted transition-colors hover:bg-mist hover:text-ink disabled:opacity-50"
              >
                复原
              </button>
            </div>
          ))
          .with({ kind: 'bind' }, ({ shortCode }) => (
            <>
              <label className={LABEL} htmlFor="admin-local">
                本地码
              </label>
              <input
                id="admin-local"
                readOnly
                value={local}
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => void copyLocal()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[0.82rem] text-muted transition-colors hover:bg-mist hover:text-ink"
              >
                <Copy size={13} className="text-icon" aria-hidden />
                {copied ? '已复制' : '复制'}
              </button>
              <p className="m-0 mt-4 text-[0.9rem] leading-relaxed text-ink">
                在运行维护群 @ OpenElaina 发送
                <span className="mx-1 font-mono">bind {shortCode}</span>
              </p>
              <button
                type="button"
                onClick={() => void confirmBind(shortCode)}
                disabled={Boolean(busy)}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-paper transition-opacity disabled:opacity-50"
              >
                {busy === 'bind' ? '确认中…' : '@ 完毕'}
              </button>
              <button
                type="button"
                onClick={leaveBind}
                className="mt-2 w-full rounded-lg border border-line px-4 py-2.5 text-[0.9rem] text-muted transition-colors hover:bg-mist hover:text-ink"
              >
                返回
              </button>
            </>
          ))
          .with({ kind: 'restore' }, () => (
            <>
              <label className={LABEL} htmlFor="admin-local">
                本地码
              </label>
              <input
                id="admin-local"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={local}
                onChange={(ev) => setLocal(ev.target.value)}
                placeholder="请输入本地码"
                className={INPUT}
              />
              {groupField}
              <button
                type="submit"
                disabled={Boolean(busy)}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-paper transition-opacity disabled:opacity-50"
              >
                {busy === 'enter' ? '校验中…' : '进入'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocal('');
                  setGroup('');
                  setError(null);
                  setStep({ kind: 'choose' });
                }}
                className="mt-2 w-full rounded-lg border border-line px-4 py-2.5 text-[0.9rem] text-muted transition-colors hover:bg-mist hover:text-ink"
              >
                返回
              </button>
            </>
          ))
          .with({ kind: 'group' }, () => (
            <>
              {groupField}
              <button
                type="submit"
                disabled={Boolean(busy)}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-paper transition-opacity disabled:opacity-50"
              >
                {busy === 'enter' ? '校验中…' : '进入'}
              </button>
            </>
          ))
          .otherwise(() => null)}
        {error ? <AdminError>{error}</AdminError> : null}
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
