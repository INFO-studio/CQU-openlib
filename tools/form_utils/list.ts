/**
 * One line per admin form submission.
 *
 *   pnpm form:list
 *   pnpm form:list -- --type textbook --status pending_confirm
 *   pnpm form:list -- --id 674abc
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FILTER_HELP, loadSubmissions, wantsHelp } from './cli';
import { formatListLine } from './format';

const HELP = `列出维护台表单提交的一行摘要。

  pnpm form:list
  pnpm form:list -- --type textbook --status pending_confirm

${FILTER_HELP}
`;

const main = async (): Promise<void> => {
  if (wantsHelp(process.argv)) {
    console.log(HELP);
    return;
  }
  const items = await loadSubmissions(process.argv);
  const lines = items.map(formatListLine);
  console.log([`共 ${items.length} 条`, ...lines].join('\n'));
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
