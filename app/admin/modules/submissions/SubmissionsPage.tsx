import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type FormType,
  type SubmissionItem,
  fetchSubmissions,
} from '~/admin/lib/api';
import {
  FORM_TYPE_META,
  formatShanghai,
  typeLabel,
  typeTone,
} from '~/admin/modules/submissions/labels';
import { renderPayload } from '~/admin/modules/submissions/renderPayload';

const FILTERS: { value: '' | FormType; label: string }[] = [
  { value: '', label: '全部' },
  ...Object.entries(FORM_TYPE_META).map(([value, meta]) => ({
    value: value as FormType,
    label: meta.label,
  })),
];

type Props = {
  /** Bumps when shell unlocks / reloads. */
  refreshToken: number;
  onUnauthorized: () => void;
};

export const SubmissionsPage = ({ refreshToken, onUnauthorized }: Props) => {
  const [type, setType] = useState<'' | FormType>('');
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchSubmissions({ type });
    if (!res.success) {
      if (res.message === 'unauthorized') onUnauthorized();
      else setError(res.message || '加载失败');
      setItems([]);
      setCount(0);
      setLoading(false);
      return;
    }
    setItems(res.items ?? []);
    setCount(res.count ?? res.items?.length ?? 0);
    setLoading(false);
  }, [type, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const summary = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.type, (map.get(item.type) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <section className="admin-submissions">
      <header className="admin-submissions__head">
        <div>
          <h1 className="admin-submissions__title">表单收集</h1>
          <p className="admin-submissions__lede">
            全量字段 · 共 {count} 条
          </p>
        </div>
        <button
          type="button"
          className="admin-submissions__refresh"
          onClick={() => void load()}
          disabled={loading}
        >
          刷新
        </button>
      </header>

      <div className="admin-filters" role="tablist" aria-label="按类型筛选">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            role="tab"
            aria-selected={type === f.value}
            className={
              type === f.value
                ? 'admin-filters__chip is-active'
                : 'admin-filters__chip'
            }
            onClick={() => setType(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {summary.length > 0 ? (
        <p className="admin-submissions__summary">
          {summary.map(([t, n]) => (
            <span key={t}>
              <i style={{ background: typeTone(t) }} />
              {typeLabel(t)} {n}
            </span>
          ))}
        </p>
      ) : null}

      {loading ? <p className="admin-empty">加载中…</p> : null}
      {error ? <p className="admin-gate__error">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="admin-empty">还没有提交记录</p>
      ) : null}

      <ul className="admin-list">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <li key={item.id} className="admin-card">
              <button
                type="button"
                className="admin-card__head"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
              >
                <span
                  className="admin-card__badge"
                  style={{
                    color: typeTone(item.type),
                    borderColor: typeTone(item.type),
                  }}
                >
                  {typeLabel(item.type)}
                </span>
                <span className="admin-card__time">
                  {formatShanghai(
                    typeof item.createdAt === 'string'
                      ? item.createdAt
                      : String(item.createdAt),
                  )}
                </span>
                <span className="admin-card__id" title={item.id}>
                  {item.id.slice(-8)}
                </span>
                <span className="admin-card__chev" aria-hidden="true">
                  {open ? '▾' : '▸'}
                </span>
              </button>

              {open ? (
                <div className="admin-card__body">
                  {renderPayload(
                    (item.payload ?? {}) as Record<string, unknown>,
                  )}
                  <dl className="admin-meta">
                    <div>
                      <dt>id</dt>
                      <dd>
                        <code>{item.id}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>ipHash</dt>
                      <dd>
                        <code>{item.ipHash ?? '—'}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>ua</dt>
                      <dd className="admin-meta__ua">{item.ua ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
