import type {
  DetailPage,
  GraduationManifest,
  GraduationOverview,
  Scope,
} from '../types';

export type Indices = {
  gradeOf: Map<number, number>;
  educationOf: Map<string, number>;
  categoryOf: Map<string, number>;
  collegeOf: Map<string, number>;
};

export const buildIndices = (manifest: GraduationManifest): Indices => ({
  gradeOf: new Map(manifest.grades.map((grade, index) => [grade, index])),
  educationOf: new Map(
    manifest.educations.map((education, index) => [education, index]),
  ),
  categoryOf: new Map(
    manifest.categories.map((category, index) => [category, index]),
  ),
  collegeOf: new Map(
    manifest.colleges.map((college, index) => [college.id, index]),
  ),
});

// An unknown facet must match nothing, not silently widen the scope.
const wanted = <T>(value: T | null, lookup: Map<T, number>): number | null =>
  value === null ? null : (lookup.get(value) ?? -1);

export type CategoryTotal = {
  category: string;
  people: number;
  orgCount: number;
};

export const categoryTotals = (
  overview: GraduationOverview,
  manifest: GraduationManifest,
  indices: Indices,
  scope: Scope,
): CategoryTotal[] => {
  const college = wanted(scope.collegeId, indices.collegeOf);
  const grade = wanted(scope.grade, indices.gradeOf);
  const education = wanted(scope.education, indices.educationOf);
  const cells = overview.cells.filter(
    ([c, g, e]) =>
      (college === null || c === college) &&
      (grade === null || g === grade) &&
      (education === null || e === education),
  );
  return manifest.categories
    .map((category, index) =>
      cells
        .filter((cell) => cell[3] === index)
        .reduce<CategoryTotal>(
          (total, [, , , , people, orgCount]) => ({
            category,
            people: total.people + people,
            orgCount: total.orgCount + orgCount,
          }),
          { category, people: 0, orgCount: 0 },
        ),
    )
    .filter((row) => row.people > 0);
};

export type GradePoint = {
  grade: number;
  people: number;
  byCategory: number[];
};

export const gradeTrend = (
  overview: GraduationOverview,
  manifest: GraduationManifest,
  indices: Indices,
  scope: Scope,
): GradePoint[] => {
  const college = wanted(scope.collegeId, indices.collegeOf);
  const education = wanted(scope.education, indices.educationOf);
  const cells = overview.cells.filter(
    ([c, , e]) =>
      (college === null || c === college) &&
      (education === null || e === education),
  );
  return manifest.grades
    .map((grade, index) => {
      const byCategory = cells
        .filter((cell) => cell[1] === index)
        .reduce<number[]>((totals, [, , , category, people]) => {
          totals[category] = (totals[category] ?? 0) + people;
          return totals;
        }, Array<number>(manifest.categories.length).fill(0));
      return {
        grade,
        people: byCategory.reduce((sum, people) => sum + people, 0),
        byCategory,
      };
    })
    .filter((point) => point.people > 0)
    .reverse();
};

export type OrgTotal = { org: string; category: string; people: number };

// Detail pages are already ranked and masked; decoding must preserve their order.
export const detailRows = (
  pages: DetailPage[],
  manifest: GraduationManifest,
  indices: Indices,
  scope: Scope,
): OrgTotal[] => {
  const category = wanted(scope.category, indices.categoryOf);
  return pages.flatMap((page) =>
    page.rows
      .filter(([, catIdx]) => category === null || catIdx === category)
      .flatMap(([orgIdx, catIdx, people]) => {
        const org = page.orgs[orgIdx];
        return org === undefined
          ? []
          : [
              {
                org,
                category: manifest.categories[catIdx] ?? '',
                people,
              },
            ];
      }),
  );
};

export const maskedTotals = (
  pages: DetailPage[],
  manifest: GraduationManifest,
  indices: Indices,
  scope: Scope,
): Array<{ category: string; people: number }> => {
  const category = wanted(scope.category, indices.categoryOf);
  return (pages[0]?.masked ?? [])
    .filter(([catIdx]) => category === null || catIdx === category)
    .map(([catIdx, people]) => ({
      category: manifest.categories[catIdx] ?? '',
      people,
    }));
};
