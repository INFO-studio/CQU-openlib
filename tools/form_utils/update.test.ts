import assert from 'node:assert/strict';
import test from 'node:test';
import type { Submission } from './types';
import {
  describeFailure,
  parseUpdateArgs,
  rejectTransition,
  resolveSubmission,
} from './update';

const item = (id: string): Submission => ({
  id,
  type: 'feedback',
  payload: {},
  ua: null,
  ipHash: null,
  createdAt: '2026-11-03T08:30:00.000Z',
  status: 'pending_confirm',
  completionNote: null,
  completedAt: null,
});

test('parses an id, a Chinese status and a completion note', () => {
  assert.deepEqual(
    parseUpdateArgs([
      'node',
      'update.ts',
      '--',
      'abc',
      '变更完成',
      '--note',
      '已写入',
    ]),
    { id: 'abc', status: 'completed', note: '已写入', api: '', key: '' },
  );
});

test('treats the same status written two ways as one choice', () => {
  assert.equal(
    parseUpdateArgs([
      'node',
      'update.ts',
      'abc',
      '变更完成',
      '--status',
      'completed',
    ]).status,
    'completed',
  );
});

test('omits the note unless --note is present', () => {
  assert.equal(
    parseUpdateArgs(['node', 'update.ts', 'abc', '--status', 'pending_change'])
      .note,
    undefined,
  );
});

test('rejects a note when the target is not completed', () => {
  assert.throws(
    () =>
      parseUpdateArgs(['node', 'update.ts', 'abc', 'blocked', '--note', 'x']),
    /完成备注/,
  );
});

test('rejects the transition the admin page also rejects', () => {
  assert.throws(
    () => rejectTransition('pending_confirm', 'completed'),
    /不能从「等待确认」转到「变更完成」/,
  );
});

test('translates the server transition error', () => {
  assert.equal(
    describeFailure('cannot transition from pending_change to pending_confirm'),
    '不能从「等待变更」转到「等待确认」',
  );
});

test('a short id must match exactly one submission', () => {
  const items = [item('aaa111'), item('bbb111')];
  assert.throws(() => resolveSubmission(items, '111'), /2 条/);
  assert.equal(resolveSubmission(items, 'aaa111').id, 'aaa111');
  assert.equal(resolveSubmission(items, 'b111').id, 'bbb111');
});
