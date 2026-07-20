import { createFileRoute } from '@tanstack/react-router';
import DocPage from '~/components/DocPage';

export const Route = createFileRoute('/$')({
  component: () => {
    const { _splat } = Route.useParams();
    return <DocPage splat={_splat} />;
  },
});
