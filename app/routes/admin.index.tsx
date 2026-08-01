import { createFileRoute } from '@tanstack/react-router';
import { useAdminSession } from '~/admin/lib/adminSession';
import { SubmissionsPage } from '~/admin/modules/submissions/SubmissionsPage';

const AdminSubmissionsRoute = () => {
  const { refreshToken, onUnauthorized } = useAdminSession();
  return (
    <SubmissionsPage
      refreshToken={refreshToken}
      onUnauthorized={onUnauthorized}
    />
  );
};

export const Route = createFileRoute('/admin/')({
  component: AdminSubmissionsRoute,
});
