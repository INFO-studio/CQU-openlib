/**
 * Full answers for admin form submissions, in the same words as the admin page.
 *
 *   pnpm form:show
 *   pnpm form:show -- --type upload --status pending_change
 *   pnpm form:show -- --id 674abc
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FILTER_HELP, loadSubmissions, wantsHelp } from './cli';
import { formatSubmission } from './format';

const HELP = `按维护台的字段名打印表单回答。

  pnpm form:show
  pnpm form:show -- --type feedback
  pnpm form:show -- --id 674abc

${FILTER_HELP}
`;

const main = async (): Promise<void> => {
  if (wantsHelp(process.argv)) {
    console.log(HELP);
    return;
  }
  const items = await loadSubmissions(process.argv);
  const body = items.map(formatSubmission).join('\n\n');
  console.log(body ? `共 ${items.length} 条\n\n${body}` : '共 0 条');
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
