/** Submissions as returned by GET /admin/submissions. */

export const FORM_TYPES = [
  'feedback',
  'textbook',
  'upload',
  'club',
  'group',
] as const;

export type FormType = (typeof FORM_TYPES)[number];

export const SUBMISSION_STATUSES = [
  'pending_confirm',
  'pending_change',
  'invalid',
  'blocked',
  'completed',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Same edges as the admin page and `POST /admin/submissions/status`. */
export const STATUS_TRANSITIONS: Record<
  SubmissionStatus,
  readonly SubmissionStatus[]
> = {
  pending_confirm: ['pending_change', 'invalid', 'blocked'],
  pending_change: ['invalid', 'blocked', 'completed'],
  invalid: ['pending_change', 'blocked', 'completed'],
  blocked: ['pending_change', 'invalid', 'completed'],
  completed: ['pending_change', 'invalid', 'blocked'],
};

export const normalizeStatus = (raw: unknown): SubmissionStatus =>
  SUBMISSION_STATUSES.find((status) => status === raw) ?? 'pending_confirm';

export const canTransition = (from: string, to: string): boolean => {
  const target = SUBMISSION_STATUSES.find((status) => status === to);
  if (!target) return false;
  return STATUS_TRANSITIONS[normalizeStatus(from)].includes(target);
};

export type Submission = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  ua: string | null;
  ipHash: string | null;
  createdAt: string;
  status: string;
  completionNote: string | null;
  completedAt: string | null;
};
