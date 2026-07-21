import { createFileRoute } from '@tanstack/react-router';
import { SubmissionsPage } from '~/admin/modules/submissions/SubmissionsPage';
import { useAdminContext } from '~/routes/admin';

const AdminIndex = () => {
  const { refreshToken, onUnauthorized } = useAdminContext();
  return (
    <SubmissionsPage
      refreshToken={refreshToken}
      onUnauthorized={onUnauthorized}
    />
  );
};

export const Route = createFileRoute('/admin/')({
  component: AdminIndex,
});
