import type { SubmissionItem } from '~/admin/lib/api';
import type { SubmissionStatus } from '~/admin/lib/status';

export type StatusAnchor = {
  status: SubmissionStatus;
  ids: ReadonlySet<string>;
};

export const createStatusAnchor = (
  items: readonly SubmissionItem[],
  status: SubmissionStatus,
): StatusAnchor => ({
  status,
  ids: new Set(
    items.filter((item) => item.status === status).map((item) => item.id),
  ),
});

export const matchesStatusFilter = (
  item: SubmissionItem,
  status: '' | SubmissionStatus,
  anchor: StatusAnchor | null,
): boolean => {
  if (!status) return true;
  if (anchor?.status === status) return anchor.ids.has(item.id);
  return item.status === status;
};
