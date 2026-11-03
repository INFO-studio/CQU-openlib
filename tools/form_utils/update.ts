/**
 * Move one admin submission along the same status edges as the admin page.
 *
 *   pnpm form:update -- <id> pending_change
 *   pnpm form:update -- <id> completed --note "已写入课程页"
 *   pnpm form:update -- <id> 变更完成 --note "已写入课程页"
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { KEY_HELP, wantsHelp } from './cli';
import { fetchSubmissions, transitionSubmission } from './client';
import { formatSubmission, statusLabel } from './format';
import {
  canTransition,
  SUBMISSION_STATUSES,
  type Submission,
  type SubmissionStatus,
} from './types';

const STATUS_INPUT: Record<string, SubmissionStatus> = {
  pending_confirm: 'pending_confirm',
  等待确认: 'pending_confirm',
  pending_change: 'pending_change',
  等待变更: 'pending_change',
  invalid: 'invalid',
  表单无效: 'invalid',
  blocked: 'blocked',
  暂时阻塞: 'blocked',
  completed: 'completed',
  变更完成: 'completed',
};

const FLAG_NAMES = new Set(['--status', '--note', '--api', '--key']);

export type UpdateArgs = {
  id: string;
  status: SubmissionStatus;
  /** Omitted unless `--note` is present. Only legal when status is completed. */
  note: string | undefined;
  api: string;
  key: string;
};

const resolveStatus = (value: string): SubmissionStatus => {
  const status = STATUS_INPUT[value];
  if (status) return status;
  throw new Error(
    `状态只能是 ${SUBMISSION_STATUSES.join(' / ')}，或对应的中文名`,
  );
};

export const parseUpdateArgs = (argv: readonly string[]): UpdateArgs => {
  const rest = argv.slice(2).filter((arg) => arg !== '--');
  const positionals = rest.filter(
    (arg, index) => !arg.startsWith('-') && !rest[index - 1]?.startsWith('--'),
  );
  // Fresh local map. It does not escape parseUpdateArgs except as copied fields.
  const flags: Record<string, string> = {};
  rest.forEach((arg, index) => {
    if (!arg.startsWith('--')) return;
    if (!FLAG_NAMES.has(arg)) throw new Error(`未知参数 ${arg}`);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${arg} 需要一个值`);
    }
    flags[arg.slice(2)] = value;
  });

  const id = positionals[0]?.trim() ?? '';
  if (!id) throw new Error('缺少 id');
  if (positionals.length > 2) throw new Error('多余参数，备注请用 --note');

  const positionalStatus = positionals[1] ? resolveStatus(positionals[1]) : '';
  const flagStatus = flags.status ? resolveStatus(flags.status) : '';
  if (positionalStatus && flagStatus && positionalStatus !== flagStatus) {
    throw new Error('--status 与位置参数冲突');
  }
  const status = flagStatus || positionalStatus;
  if (!status) throw new Error('缺少状态');

  const hasNote = Object.hasOwn(flags, 'note');
  if (hasNote && status !== 'completed') {
    throw new Error('完成备注只在状态为 completed 时写入');
  }
  if ((flags.note ?? '').length > 4000) throw new Error('完成备注超过 4000 字');

  return {
    id,
    status,
    note: hasNote ? flags.note : undefined,
    api: (flags.api ?? '').replace(/\/$/, ''),
    key: flags.key ?? '',
  };
};

export const resolveSubmission = (
  items: readonly Submission[],
  id: string,
): Submission => {
  const matches = items.filter(
    (item) => item.id === id || item.id.endsWith(id),
  );
  const only = matches.length === 1 ? matches[0] : undefined;
  if (only) return only;
  if (matches.length === 0) throw new Error(`没有 id 匹配 ${id} 的提交`);
  throw new Error(
    `id 后缀匹配了 ${matches.length} 条：${matches.map((item) => item.id).join(' ')}`,
  );
};

export const rejectTransition = (from: string, to: string): void => {
  if (canTransition(from, to)) return;
  throw new Error(`不能从「${statusLabel(from)}」转到「${statusLabel(to)}」`);
};

export const describeFailure = (message: string): string => {
  const found = message.match(/^cannot transition from (\S+) to (\S+)$/);
  const from = found?.[1];
  const to = found?.[2];
  if (from && to) {
    return `不能从「${statusLabel(from)}」转到「${statusLabel(to)}」`;
  }
  if (message === 'not found') return '没有这条提交';
  if (message === 'invalid id') return 'id 无效';
  if (message === 'invalid body') return '请求无效';
  return message;
};

const HELP = `把一条表单提交流转到新状态。id 可以是完整 id，或唯一后缀。

  pnpm form:update -- <id> pending_change
  pnpm form:update -- <id> completed --note "已写入课程页"
  pnpm form:update -- <id> 变更完成 --note "已写入课程页"

状态：pending_confirm 等待确认
      pending_change 等待变更
      invalid 表单无效
      blocked 暂时阻塞
      completed 变更完成
等待确认只能进入等待变更、表单无效、暂时阻塞。
后三者可以互相转，也可以标为变更完成。
变更完成只能回到这三者。完成备注只在进入变更完成时写入。

${KEY_HELP}
`;

const main = async (): Promise<void> => {
  if (wantsHelp(process.argv)) {
    console.log(HELP);
    return;
  }
  const args = parseUpdateArgs(process.argv);
  const current = resolveSubmission(
    await fetchSubmissions({
      api: args.api,
      key: args.key,
      type: '',
      status: '',
    }),
    args.id,
  );
  rejectTransition(current.status, args.status);
  const updated = await transitionSubmission({
    api: args.api,
    key: args.key,
    id: current.id,
    status: args.status,
    completionNote: args.note,
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(describeFailure(message));
  });
  console.log(formatSubmission(updated));
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
