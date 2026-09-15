import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMetadata, extractEntries } from './extract';

test('extracts escaped labels, encoded paths and marked course codes', () => {
  assert.deepEqual(
    extractEntries(
      String.raw`* [课程\[一\]\-II](../../../course/课程%20%28一%29.md) - :l-book:\`*A1\``.replace(
        /\\`/g,
        '`',
      ),
    ),
    [{ label: '课程[一]-II', path: '/course/课程 (一)', code: 'A1' }],
  );
  assert.equal(
    extractEntries('* [课](../../../course/课.md) - :l-book:`未提供`').length,
    0,
  );
});

test('retains every conflict candidate without a majority winner', () => {
  const first = '[课甲](../../../course/甲.md) - :l-book:`A1`';
  const second = '[课乙](../../../course/乙.md) - :l-book:`A1`';
  const metadata = buildMetadata([`${first}\n${first}\n${second}`]);
  assert.equal(metadata.byCode.A1, undefined);
  assert.equal(metadata.stats.codes, 1);
  assert.equal(metadata.conflicts.length, 1);
  assert.deepEqual(
    new Set(metadata.conflicts[0]?.candidates.map((item) => item.path)),
    new Set(['/course/甲', '/course/乙']),
  );
  assert.deepEqual(metadata.courses['/course/甲']?.codes, ['A1']);
});

test('deduplicates course codes and produces stable metadata', () => {
  const text = '[数学](../../../course/数学.md) - :l-book:`M1`';
  const result = buildMetadata([text, text]);
  assert.deepEqual(result.courses['/course/数学']?.codes, ['M1']);
  assert.equal(result.byCode.M1, '/course/数学');
  assert.equal(result.stats.matches, 2);
  assert.deepEqual(result, buildMetadata([text, text]));
});
