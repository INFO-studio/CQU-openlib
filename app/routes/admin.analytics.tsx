import { createFileRoute } from '@tanstack/react-router';
import { useAdminSession } from '~/admin/lib/adminSession';
import { AnalyticsPage } from '~/admin/modules/analytics/AnalyticsPage';

const AdminAnalyticsRoute = () => {
  const { refreshToken, onUnauthorized } = useAdminSession();
  return (
    <AnalyticsPage
      refreshToken={refreshToken}
      onUnauthorized={onUnauthorized}
    />
  );
};

export const Route = createFileRoute('/admin/analytics')({
  component: AdminAnalyticsRoute,
});
