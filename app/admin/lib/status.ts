/** Submission workflow status — mirrors API `submissionStatus`. */

export const SUBMISSION_STATUSES = [
  'pending_confirm',
  'pending_change',
  'invalid',
  'blocked',
  'completed',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const DEFAULT_SUBMISSION_STATUS: SubmissionStatus = 'pending_confirm';

export const STATUS_META: Record<
  SubmissionStatus,
  { label: string; tone: string }
> = {
  pending_confirm: { label: '等待确认', tone: '#8aa0c8' },
  pending_change: { label: '等待变更', tone: '#c4a06a' },
  invalid: { label: '表单无效', tone: '#e08a8a' },
  blocked: { label: '暂时阻塞', tone: '#9a8ab0' },
  completed: { label: '变更完成', tone: '#6ab59a' },
};

const WORK_STATUSES = [
  'pending_change',
  'invalid',
  'blocked',
] as const satisfies readonly SubmissionStatus[];

export const STATUS_TRANSITIONS: Record<
  SubmissionStatus,
  readonly SubmissionStatus[]
> = {
  pending_confirm: [...WORK_STATUSES],
  pending_change: ['invalid', 'blocked', 'completed'],
  invalid: ['pending_change', 'blocked', 'completed'],
  blocked: ['pending_change', 'invalid', 'completed'],
  completed: [...WORK_STATUSES, 'completed'],
};

export const statusLabel = (status: string): string =>
  STATUS_META[status as SubmissionStatus]?.label ?? status;

export const statusTone = (status: string): string =>
  STATUS_META[status as SubmissionStatus]?.tone ?? '#8a909c';

export const normalizeStatus = (raw: unknown): SubmissionStatus =>
  SUBMISSION_STATUSES.includes(raw as SubmissionStatus)
    ? (raw as SubmissionStatus)
    : DEFAULT_SUBMISSION_STATUS;

export const nextStatuses = (
  current: SubmissionStatus,
): readonly SubmissionStatus[] => STATUS_TRANSITIONS[current];
