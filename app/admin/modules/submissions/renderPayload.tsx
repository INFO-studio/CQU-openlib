import type { ReactNode } from 'react';
import {
  CATEGORY_LABELS,
  fieldLabel,
  formatBytes,
} from '~/admin/modules/submissions/labels';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const formatScalar = (key: string, value: unknown): string => {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (key === 'canContact' || key === 'hasHd') {
    if (value === 'yes') return '是';
    if (value === 'no') return '否';
  }
  if (key === 'contactKind') {
    const map: Record<string, string> = {
      qq: 'QQ',
      wechat: '微信',
      email: '邮箱',
      phone: '手机',
    };
    return map[String(value)] ?? String(value);
  }
  if (
    key === 'confirmAuthorized' ||
    key === 'confirmNoPii'
  ) {
    if (value === 'yes') return '已确认';
  }
  if (key === 'category' && typeof value === 'string') {
    return CATEGORY_LABELS[value] ?? value;
  }
  if (key === 'introKind') {
    if (value === 'text') return '纯文字';
    if (value === 'file') return '上传文件';
  }
  if (key === 'updateKind') {
    const map: Record<string, string> = {
      change: '社团变动',
      recruit: '纳新群号',
      intro: '社团简介',
    };
    return map[String(value)] ?? String(value);
  }
  if (key === 'changeType') {
    const map: Record<string, string> = {
      join: '新社团加入',
      rename: '社团更名',
      dissolve: '社团解散',
    };
    return map[String(value)] ?? String(value);
  }
  if (key === 'size') return formatBytes(value);
  return String(value);
};

const FileBlock = ({ value }: { value: Record<string, unknown> }) => (
  <div className="admin-file">
    <div className="admin-file__name">{String(value.name ?? '未命名')}</div>
    <dl className="admin-file__meta">
      <div>
        <dt>key</dt>
        <dd>
          <code>{String(value.key ?? '—')}</code>
        </dd>
      </div>
      <div>
        <dt>大小</dt>
        <dd>{formatBytes(value.size)}</dd>
      </div>
    </dl>
  </div>
);

const FieldRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="admin-field">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

export const renderPayload = (payload: Record<string, unknown>): ReactNode => {
  const entries = Object.entries(payload).filter(([, v]) => {
    if (v == null) return false;
    if (v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  if (entries.length === 0) {
    return <p className="admin-empty">无字段</p>;
  }

  return (
    <dl className="admin-fields">
      {entries.map(([key, value]) => {
        if (key === 'file' || key === 'introFile') {
          if (isPlainObject(value)) {
            return (
              <FieldRow key={key} label={fieldLabel(key)}>
                <FileBlock value={value} />
              </FieldRow>
            );
          }
        }

        if (key === 'books' && Array.isArray(value)) {
          return (
            <FieldRow key={key} label={fieldLabel(key)}>
              <ol className="admin-books">
                {value.map((book, i) => (
                  <li key={i}>
                    {isPlainObject(book) ? (
                      <dl className="admin-fields admin-fields--nested">
                        {Object.entries(book).map(([bk, bv]) => (
                          <FieldRow key={bk} label={fieldLabel(bk)}>
                            {bk === 'file' && isPlainObject(bv) ? (
                              <FileBlock value={bv} />
                            ) : (
                              formatScalar(bk, bv)
                            )}
                          </FieldRow>
                        ))}
                      </dl>
                    ) : (
                      String(book)
                    )}
                  </li>
                ))}
              </ol>
            </FieldRow>
          );
        }

        if (isPlainObject(value)) {
          return (
            <FieldRow key={key} label={fieldLabel(key)}>
              <dl className="admin-fields admin-fields--nested">
                {Object.entries(value).map(([ck, cv]) => (
                  <FieldRow key={ck} label={fieldLabel(ck)}>
                    {formatScalar(ck, cv)}
                  </FieldRow>
                ))}
              </dl>
            </FieldRow>
          );
        }

        if (Array.isArray(value)) {
          return (
            <FieldRow key={key} label={fieldLabel(key)}>
              <pre className="admin-pre">{JSON.stringify(value, null, 2)}</pre>
            </FieldRow>
          );
        }

        return (
          <FieldRow key={key} label={fieldLabel(key)}>
            {typeof value === 'string' && value.length > 160 ? (
              <pre className="admin-pre admin-pre--wrap">{value}</pre>
            ) : (
              formatScalar(key, value)
            )}
          </FieldRow>
        );
      })}
    </dl>
  );
};
