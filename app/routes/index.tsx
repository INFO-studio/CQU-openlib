import { createFileRoute } from '@tanstack/react-router';
import DocPage from '~/components/DocPage';

const IndexPage = () => <DocPage />;

export const Route = createFileRoute('/')({
  component: IndexPage,
});
