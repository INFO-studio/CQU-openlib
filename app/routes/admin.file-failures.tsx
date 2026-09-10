import { createFileRoute } from '@tanstack/react-router';
import { useAdminSession } from '~/admin/lib/adminSession';
import { FileFailuresPage } from '~/admin/modules/file-failures/FileFailuresPage';

const AdminFileFailuresRoute = () => {
  const { refreshToken, onUnauthorized } = useAdminSession();
  return (
    <FileFailuresPage
      refreshToken={refreshToken}
      onUnauthorized={onUnauthorized}
    />
  );
};

export const Route = createFileRoute('/admin/file-failures')({
  component: AdminFileFailuresRoute,
});
