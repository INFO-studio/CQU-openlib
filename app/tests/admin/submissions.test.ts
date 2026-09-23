import { describe, expect, it } from 'vite-plus/test';
import type { SubmissionItem } from '~/admin/lib/api';
import { nextStatuses } from '~/admin/lib/status';
import {
  createStatusAnchor,
  matchesStatusFilter,
} from '~/admin/modules/submissions/statusAnchor';

const submission = (
  id: string,
  status: SubmissionItem['status'],
): SubmissionItem => ({
  id,
  type: 'feedback',
  payload: {},
  ua: null,
  ipHash: null,
  createdAt: '2026-09-24T00:00:00.000Z',
  status,
  completionNote: null,
  completedAt: null,
});

describe('submission status actions', () => {
  it('places completed first among the three workflow targets', () => {
    expect(nextStatuses('pending_change')).toEqual([
      'completed',
      'invalid',
      'blocked',
    ]);
    expect(nextStatuses('invalid')).toEqual([
      'completed',
      'pending_change',
      'blocked',
    ]);
    expect(nextStatuses('blocked')).toEqual([
      'completed',
      'pending_change',
      'invalid',
    ]);
  });
});

describe('status filter anchor', () => {
  it('keeps the records captured when a status tab is selected', () => {
    const waiting = submission('waiting', 'pending_change');
    const other = submission('other', 'invalid');
    const anchor = createStatusAnchor([waiting, other], 'pending_change');

    expect(
      matchesStatusFilter(
        { ...waiting, status: 'completed' },
        'pending_change',
        anchor,
      ),
    ).toBe(true);
    expect(
      matchesStatusFilter(
        { ...other, status: 'pending_change' },
        'pending_change',
        anchor,
      ),
    ).toBe(false);
  });

  it('uses the current statuses after switching tabs', () => {
    const completed = submission('completed', 'completed');
    const waiting = submission('waiting', 'pending_change');
    const anchor = createStatusAnchor([completed, waiting], 'completed');

    expect(matchesStatusFilter(completed, 'completed', anchor)).toBe(true);
    expect(matchesStatusFilter(waiting, 'completed', anchor)).toBe(false);
    expect(matchesStatusFilter(waiting, '', null)).toBe(true);
  });
});
