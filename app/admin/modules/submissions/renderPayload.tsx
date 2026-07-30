import type { ReactNode } from 'react';
import {
  CATEGORY_LABELS,
  fieldLabel,
  formatBytes,
} from '~/admin/modules/submissions/labels';
import { cn } from '~/lib/cn';

const PRE =
  'm-0 overflow-x-auto whitespace-pre-wrap rounded border border-line bg-paper px-2.5 py-2 font-mono text-[0.76rem]';

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
    };
    return map[String(value)] ?? String(value);
  }
  if (key === 'confirmAuthorized' || key === 'confirmNoPii') {
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
  <div className="rounded-md border border-dashed border-line bg-mist px-2.5 py-2">
    <div className="text-[0.88rem] font-semibold">
      {String(value.name ?? '未命名')}
    </div>
    <dl className="m-0 mt-1.5 grid gap-1">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 text-[0.76rem]">
        <dt className="text-icon">key</dt>
        <dd className="m-0 break-all font-mono">{String(value.key ?? '—')}</dd>
      </div>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 text-[0.76rem]">
        <dt className="text-icon">大小</dt>
        <dd className="m-0">{formatBytes(value.size)}</dd>
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
  <div className="grid items-start gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(6rem,8rem)_minmax(0,1fr)]">
    <dt className="m-0 pt-0.5 text-[0.76rem] text-icon">{label}</dt>
    <dd className="m-0 break-words text-[0.88rem] leading-relaxed">
      {children}
    </dd>
  </div>
);

const FieldList = ({
  children,
  nested,
}: {
  children: ReactNode;
  nested?: boolean;
}) => (
  <dl
    className={cn(
      'm-0 grid gap-2',
      nested
        ? 'mt-1.5 rounded-md border border-line bg-paper px-2.5 py-2'
        : 'mt-3.5',
    )}
  >
    {children}
  </dl>
);

export const renderPayload = (payload: Record<string, unknown>): ReactNode => {
  const entries = Object.entries(payload).filter(([, v]) => {
    if (v == null) return false;
    if (v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  if (entries.length === 0) {
    return (
      <p className="m-0 mt-3.5 rounded-md border border-dashed border-line px-3 py-2.5 text-center text-[0.82rem] text-icon">
        这条提交没有填写任何字段
      </p>
    );
  }

  return (
    <FieldList>
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
              <ol className="m-0 grid gap-2.5 pl-4">
                {value.map((book, i) => (
                  <li key={i}>
                    {isPlainObject(book) ? (
                      <FieldList nested>
                        {Object.entries(book).map(([bk, bv]) => (
                          <FieldRow key={bk} label={fieldLabel(bk)}>
                            {bk === 'file' && isPlainObject(bv) ? (
                              <FileBlock value={bv} />
                            ) : (
                              formatScalar(bk, bv)
                            )}
                          </FieldRow>
                        ))}
                      </FieldList>
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
              <FieldList nested>
                {Object.entries(value).map(([ck, cv]) => (
                  <FieldRow key={ck} label={fieldLabel(ck)}>
                    {formatScalar(ck, cv)}
                  </FieldRow>
                ))}
              </FieldList>
            </FieldRow>
          );
        }

        if (Array.isArray(value)) {
          return (
            <FieldRow key={key} label={fieldLabel(key)}>
              <pre className={PRE}>{JSON.stringify(value, null, 2)}</pre>
            </FieldRow>
          );
        }

        return (
          <FieldRow key={key} label={fieldLabel(key)}>
            {typeof value === 'string' && value.length > 160 ? (
              <pre className={PRE}>{value}</pre>
            ) : (
              formatScalar(key, value)
            )}
          </FieldRow>
        );
      })}
    </FieldList>
  );
};
