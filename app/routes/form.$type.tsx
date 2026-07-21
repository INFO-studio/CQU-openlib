import { createFileRoute, redirect } from '@tanstack/react-router';
import { CommunityForm } from '~/components/forms/CommunityForm';
import { isFormSlug } from '~/lib/formTypes';

type FormSearch = {
  page?: string;
};

const FormRoute = () => {
  const { type } = Route.useParams();
  const { page } = Route.useSearch();
  if (!isFormSlug(type)) return null;
  return <CommunityForm type={type} initialPage={page ?? ''} />;
};

export const Route = createFileRoute('/form/$type')({
  validateSearch: (search: Record<string, unknown>): FormSearch => ({
    page: typeof search.page === 'string' ? search.page : undefined,
  }),
  beforeLoad: ({ params }) => {
    if (!isFormSlug(params.type)) {
      throw redirect({
        to: '/form/$type',
        params: { type: 'feedback' },
        search: {},
      });
    }
  },
  component: FormRoute,
});
