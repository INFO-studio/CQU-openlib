import { fetchSubmissions } from './client';
import { FORM_TYPES, SUBMISSION_STATUSES, type Submission } from './types';

export type Filters = {
  type: string;
  status: string;
  id: string;
  api: string;
  token: string;
  localCode: string;
  groupCode: string;
};

const FLAG_NAMES = new Set([
  '--type',
  '--status',
  '--id',
  '--api',
  '--token',
  '--local-code',
  '--group-code',
]);

export const KEY_HELP = `鉴权：在 .env 或环境变量配置 ADMIN_LOCAL_CODE（8 位本地码）和 ADMIN_GROUP_CODE（4 位群码），
      或命令行传 --local-code / --group-code / --token（或 ADMIN_SESSION_TOKEN）。
      本地码 + 群码会自动换取 24 小时会话并缓存在 tools/form_utils/data/.session.json。
接口：默认 https://api.cqu-openlib.cn，可用 --api 覆盖
输出含联系方式，不要贴到公开场合。`;

export const FILTER_HELP = `筛选：--type ${FORM_TYPES.join('|')}
      --status ${SUBMISSION_STATUSES.join('|')}
      --id <完整 id 或后缀>
${KEY_HELP}`;

export const wantsHelp = (argv: readonly string[]): boolean =>
  argv.includes('--help') || argv.includes('-h');

const assertOneOf = (
  name: string,
  value: string,
  allowed: readonly string[],
): void => {
  if (value && !allowed.includes(value)) {
    throw new Error(`${name} 只能是 ${allowed.join(' / ')}`);
  }
};

export const parseArgs = (argv: readonly string[]): Filters => {
  const rest = argv.slice(2).filter((arg) => arg !== '--');
  const positional = rest.filter(
    (arg, index) => !arg.startsWith('-') && !rest[index - 1]?.startsWith('--'),
  );
  if (positional.length > 0) {
    throw new Error(`多余参数 ${positional.join(' ')}`);
  }

  // Fresh local map. It does not escape parseArgs except as copied fields.
  const flags: Record<string, string> = {};
  rest.forEach((arg, index) => {
    if (!arg.startsWith('--')) return;
    if (!FLAG_NAMES.has(arg)) throw new Error(`未知参数 ${arg}`);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${arg} 需要一个值`);
    flags[arg.slice(2)] = value;
  });

  assertOneOf('--type', flags.type ?? '', FORM_TYPES);
  assertOneOf('--status', flags.status ?? '', SUBMISSION_STATUSES);
  return {
    type: flags.type ?? '',
    status: flags.status ?? '',
    id: flags.id ?? '',
    api: (flags.api ?? '').replace(/\/$/, ''),
    token: flags.token ?? '',
    localCode: flags['local-code'] ?? '',
    groupCode: flags['group-code'] ?? '',
  };
};

export const loadSubmissions = async (
  argv: readonly string[],
): Promise<Submission[]> => {
  const filters = parseArgs(argv);
  const items = await fetchSubmissions(filters);
  if (!filters.id) return items;
  return items.filter(
    (item) => item.id === filters.id || item.id.endsWith(filters.id),
  );
};
