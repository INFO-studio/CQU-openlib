import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parseArgs } from './cli';
import {
  type FetchLike,
  fetchSubmissions,
  readEnvValue,
  resolveAdminAuth,
  transitionSubmission,
} from './client';
import {
  formatBytes,
  formatListLine,
  formatShanghai,
  formatSubmission,
} from './format';
import type { Submission } from './types';

const sample = (patch: Partial<Submission> = {}): Submission => ({
  id: 'abcdef1234567890',
  type: 'textbook',
  payload: {},
  ua: 'ua',
  ipHash: 'hash',
  createdAt: '2026-11-03T08:30:00.000Z',
  status: 'pending_confirm',
  completionNote: null,
  completedAt: null,
  ...patch,
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('formats Shanghai wall time and byte sizes', () => {
  assert.equal(
    formatShanghai('2026-11-03T08:30:00.000Z'),
    '2026-11-03 16:30:00',
  );
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.00 MB');
});

test('prints textbook answers in form order and drops blank fields', () => {
  const text = formatSubmission(
    sample({
      payload: {
        credit: '',
        course: '高等数学',
        year: '2024',
        books: [
          {
            name: '高等数学',
            kind: '课本',
            hasHd: 'yes',
            file: { key: 'staging/a', name: 'a.pdf', size: 1536 },
          },
        ],
        canContact: 'no',
        courseCode: 'MATH',
      },
    }),
  );
  assert.equal(
    text,
    [
      '教材收集 · 等待确认 · 2026-11-03 16:30:00',
      'id  abcdef1234567890',
      '',
      '入学学年',
      '  2024',
      '课程名',
      '  高等数学',
      '课程号',
      '  MATH',
      '教材列表',
      '  1. 高等数学',
      '    类型',
      '      课本',
      '    有高清资源',
      '      是',
      '    文件',
      '      a.pdf',
      '      对象键  staging/a',
      '      大小  1.5 KB',
      '可否联系',
      '  否',
      '',
      'ipHash  hash',
      'ua  ua',
    ].join('\n'),
  );
});

test('keeps feedback question order ahead of payload key order', () => {
  const text = formatSubmission(
    sample({
      type: 'feedback',
      payload: { page: '/course/x', content: '链接失效', contactKind: 'qq' },
    }),
  );
  assert.ok(text.indexOf('问题说明') < text.indexOf('相关页面'));
  assert.match(text, /联系渠道\n {2}QQ/);
});

test('collapses a list line to a single row', () => {
  const line = formatListLine(
    sample({
      type: 'feedback',
      payload: { content: '第一行\n第二行' },
    }),
  );
  assert.equal(line.includes('\n'), false);
  assert.match(
    line,
    /页面反馈 {2}等待确认 {2}第一行 第二行 {2}abcdef1234567890/,
  );
});

test('reads an env assignment without taking comments', () => {
  const text = '# ADMIN_LOCAL_CODE=nope\nexport ADMIN_LOCAL_CODE="ABCD1234"\n';
  assert.equal(readEnvValue(text, 'ADMIN_LOCAL_CODE'), 'ABCD1234');
});

test('prefers explicit token or ADMIN_SESSION_TOKEN over codes', () => {
  assert.deepEqual(
    resolveAdminAuth(
      { token: '  tok-1  ', localCode: 'abcd1234', groupCode: 'ef56' },
      {},
      '',
    ),
    { kind: 'token', token: 'tok-1' },
  );
  assert.deepEqual(
    resolveAdminAuth({}, { ADMIN_SESSION_TOKEN: 'env-tok' }, ''),
    { kind: 'token', token: 'env-tok' },
  );
});

test('resolves and normalizes localCode and groupCode from flags, env, and repo .env text', () => {
  assert.deepEqual(
    resolveAdminAuth(
      {},
      { ADMIN_LOCAL_CODE: ' AbCd1234 ', ADMIN_GROUP_CODE: ' Z9X1 ' },
      'ADMIN_LOCAL_CODE=1111aaaa\nADMIN_GROUP_CODE=0000\n',
    ),
    { kind: 'codes', localCode: 'abcd1234', groupCode: 'z9x1' },
  );

  assert.deepEqual(
    resolveAdminAuth(
      {},
      {},
      'ADMIN_LOCAL_CODE=1111aaaa\nADMIN_GROUP_CODE=99zz\n',
    ),
    { kind: 'codes', localCode: '1111aaaa', groupCode: '99zz' },
  );

  assert.throws(
    () => resolveAdminAuth({}, { ADMIN_LOCAL_CODE: 'abcd1234' }, ''),
    /缺少维护台凭证/,
  );
  assert.throws(
    () =>
      resolveAdminAuth(
        {},
        { ADMIN_LOCAL_CODE: 'short', ADMIN_GROUP_CODE: 'ab3d' },
        '',
      ),
    /ADMIN_LOCAL_CODE 格式无效/,
  );
  assert.throws(
    () =>
      resolveAdminAuth(
        {},
        { ADMIN_LOCAL_CODE: 'abcd1234', ADMIN_GROUP_CODE: 'abc' },
        '',
      ),
    /ADMIN_GROUP_CODE 格式无效/,
  );
});

test('exchanges session once and reuses cache across calls', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'form-utils-session-'));
  const cachePath = join(dir, '.session.json');
  const nowMs = 1_700_000_000_000;
  const issueCalls: string[] = [];

  const stubFetch: FetchLike = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const auth = headers.get('Authorization') ?? undefined;

    if (url.endsWith('/admin/session')) {
      const token = `tok-v${issueCalls.length + 1}`;
      issueCalls.push(token);
      return jsonResponse({
        success: true,
        token,
        expiresAt: nowMs + 24 * 60 * 60 * 1000,
      });
    }

    if (auth !== 'Bearer tok-v1') {
      return jsonResponse({ success: false, message: 'unauthorized' }, 401);
    }

    if (url.endsWith('/admin/submissions/status')) {
      return jsonResponse({
        success: true,
        item: sample({ status: 'completed', completionNote: 'done' }),
      });
    }

    return jsonResponse({ success: true, items: [sample()] });
  };

  try {
    const first = await fetchSubmissions({
      api: 'https://example.test',
      localCode: 'abcd1234',
      groupCode: 'ef56',
      type: '',
      status: '',
      cachePath,
      now: () => nowMs,
      fetchImpl: stubFetch,
      env: {},
      envText: '',
    });
    assert.equal(first.length, 1);
    assert.equal(issueCalls.length, 1);

    const cacheJson = JSON.parse(readFileSync(cachePath, 'utf8')) as {
      token: string;
      localCodeHash: string;
    };
    assert.equal(cacheJson.token, 'tok-v1');
    assert.equal(cacheJson.localCodeHash.includes('abcd1234'), false);

    // Second call with same codes reuses cached token without hitting /admin/session
    await transitionSubmission({
      api: 'https://example.test',
      localCode: 'abcd1234',
      groupCode: 'ef56',
      id: 'abcdef1234567890',
      status: 'completed',
      completionNote: 'done',
      cachePath,
      now: () => nowMs + 1000,
      fetchImpl: stubFetch,
      env: {},
      envText: '',
    });
    assert.equal(issueCalls.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('evicts stale cached token on 401 and retries once after re-login, and invalidates when localCode changes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'form-utils-relogin-'));
  const cachePath = join(dir, '.session.json');
  const nowMs = 1_700_000_000_000;
  const activeTokens = new Set<string>();
  const loginPayloads: string[] = [];

  const stubFetch: FetchLike = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const auth = headers.get('Authorization') ?? '';

    if (url.endsWith('/admin/session')) {
      const payload = typeof init?.body === 'string' ? init.body : '';
      loginPayloads.push(payload);
      const token = `tok-${loginPayloads.length}`;
      activeTokens.add(token);
      return jsonResponse({
        success: true,
        token,
        expiresAt: nowMs + 24 * 60 * 60 * 1000,
      });
    }

    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!activeTokens.has(token)) {
      return jsonResponse({ success: false, message: 'unauthorized' }, 401);
    }
    return jsonResponse({ success: true, items: [sample()] });
  };

  try {
    // 1. Initial login -> tok-1 cached
    await fetchSubmissions({
      api: 'https://example.test',
      localCode: 'abcd1234',
      groupCode: 'ef56',
      type: '',
      status: '',
      cachePath,
      now: () => nowMs,
      fetchImpl: stubFetch,
      env: {},
      envText: '',
    });
    assert.equal(loginPayloads.length, 1);

    // 2. Simulate server-side session revocation -> cached tok-1 fails 401, auto re-logs as tok-2
    activeTokens.delete('tok-1');
    const retried = await fetchSubmissions({
      api: 'https://example.test',
      localCode: 'abcd1234',
      groupCode: 'ef56',
      type: '',
      status: '',
      cachePath,
      now: () => nowMs + 5000,
      fetchImpl: stubFetch,
      env: {},
      envText: '',
    });
    assert.equal(retried.length, 1);
    assert.equal(loginPayloads.length, 2);

    // 3. Changing localCode bypasses cached tok-2 and logs in as tok-3
    await fetchSubmissions({
      api: 'https://example.test',
      localCode: 'wxyz9876',
      groupCode: 'ef56',
      type: '',
      status: '',
      cachePath,
      now: () => nowMs + 10_000,
      fetchImpl: stubFetch,
      env: {},
      envText: '',
    });
    assert.equal(loginPayloads.length, 3);
    assert.match(loginPayloads[2] ?? '', /wxyz9876/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects an unknown form type and legacy --key flag', () => {
  assert.throws(
    () => parseArgs(['node', 'list.ts', '--type', 'nope']),
    /--type 只能是/,
  );
  assert.throws(
    () => parseArgs(['node', 'list.ts', '--key', 'old']),
    /未知参数 --key/,
  );
});

test('reads filters and ignores a pnpm separator', () => {
  assert.deepEqual(
    parseArgs([
      'node',
      'show.ts',
      '--',
      '--status',
      'completed',
      '--id',
      'abc',
      '--local-code',
      'abcd1234',
      '--group-code',
      'ef56',
    ]),
    {
      type: '',
      status: 'completed',
      id: 'abc',
      api: '',
      token: '',
      localCode: 'abcd1234',
      groupCode: 'ef56',
    },
  );
});
