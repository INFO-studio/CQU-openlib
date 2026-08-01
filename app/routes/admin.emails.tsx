import { createFileRoute } from '@tanstack/react-router';
import { useAdminSession } from '~/admin/lib/adminSession';
import { EmailsPage } from '~/admin/modules/emails/EmailsPage';

const AdminEmailsRoute = () => {
  const { refreshToken, onUnauthorized } = useAdminSession();
  return (
    <EmailsPage refreshToken={refreshToken} onUnauthorized={onUnauthorized} />
  );
};

export const Route = createFileRoute('/admin/emails')({
  component: AdminEmailsRoute,
});
