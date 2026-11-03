/**
 * Raw JSON for admin form submissions. Same filters as list / show.
 *
 *   pnpm form:json
 *   ./node_modules/.bin/tsx tools/form_utils/json.ts --type club \
 *     > tools/form_utils/data/club.json
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FILTER_HELP, loadSubmissions, wantsHelp } from './cli';

const HELP = `把维护台表单提交打成 JSON 数组。

  pnpm form:json
  pnpm form:json -- --status completed

导出放在 tools/form_utils/data/。重定向时用 tsx，pnpm 会先往标准输出写依赖检查，把 JSON 弄脏：

  ./node_modules/.bin/tsx tools/form_utils/json.ts --status completed > tools/form_utils/data/completed.json

${FILTER_HELP}
`;

const main = async (): Promise<void> => {
  if (wantsHelp(process.argv)) {
    console.log(HELP);
    return;
  }
  const items = await loadSubmissions(process.argv);
  console.log(`${JSON.stringify(items, null, 2)}\n`);
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
