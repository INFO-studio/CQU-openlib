import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs } from './cli';
import { readEnvValue, resolveAdminKey, shanghaiDate } from './client';
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

test('formats Shanghai wall time and byte sizes', () => {
  assert.equal(
    formatShanghai('2026-11-03T08:30:00.000Z'),
    '2026-11-03 16:30:00',
  );
  assert.equal(shanghaiDate(new Date('2026-11-02T16:30:00.000Z')), '20261103');
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
  const text =
    '# ADMIN_PAGE_TOKEN_PREFIX=nope\nexport ADMIN_PAGE_TOKEN_PREFIX="abc"\n';
  assert.equal(readEnvValue(text, 'ADMIN_PAGE_TOKEN_PREFIX'), 'abc');
});

test('an explicit key is used as the bearer token', () => {
  assert.equal(resolveAdminKey('  full-key  '), 'full-key');
});

test('a prefix from the environment gets the Shanghai date', () => {
  const previous = process.env.ADMIN_PAGE_TOKEN_PREFIX;
  process.env.ADMIN_PAGE_TOKEN_PREFIX = 'pre';
  try {
    assert.equal(
      resolveAdminKey('', new Date('2026-11-02T16:30:00.000Z')),
      'pre20261103',
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PAGE_TOKEN_PREFIX;
    else process.env.ADMIN_PAGE_TOKEN_PREFIX = previous;
  }
});

test('rejects an unknown form type', () => {
  assert.throws(
    () => parseArgs(['node', 'list.ts', '--type', 'nope']),
    /--type 只能是/,
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
    ]),
    { type: '', status: 'completed', id: 'abc', api: '', key: '' },
  );
});
