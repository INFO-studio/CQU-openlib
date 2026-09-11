import { createFileRoute } from '@tanstack/react-router';
import GraduationPage from '~/pages/academic/graduation/GraduationPage';
import type { GraduationSearch } from '~/pages/academic/graduation/utils/scopeSearch';
import { validateGraduationSearch } from '~/pages/academic/graduation/utils/scopeSearch';

export const Route = createFileRoute('/academic/graduation')({
  validateSearch: (search: Record<string, unknown>): GraduationSearch =>
    validateGraduationSearch(search),
  component: GraduationPage,
});
