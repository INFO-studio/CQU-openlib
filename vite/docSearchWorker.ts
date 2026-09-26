import process from 'node:process';
import { refreshSearchCache } from './docSearch';

const root = process.argv[2];

const send = (message: unknown): Promise<void> =>
  new Promise((resolve) => {
    if (!process.send) {
      resolve();
      return;
    }
    process.send(message, undefined, undefined, () => resolve());
  });

const finish = async (message: unknown, exitCode = 0): Promise<void> => {
  await send(message);
  if (process.connected) process.disconnect();
  process.exitCode = exitCode;
};

const run = async (): Promise<void> => {
  if (!root) {
    await finish({ type: 'error', message: '搜索索引进程缺少项目根目录' }, 1);
    return;
  }
  try {
    const result = await refreshSearchCache(root);
    await finish({ type: 'complete', result });
  } catch (error) {
    await finish(
      {
        type: 'error',
        message: error instanceof Error ? error.stack : String(error),
      },
      1,
    );
  }
};

void run();
