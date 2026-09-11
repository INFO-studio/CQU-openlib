/**
 * Pure reductions over the dictionary-encoded chunks. A `null` facet in a
 * Scope means "all of them".
 *
 * Only overview cells are reduced here. The 单位 ranking is *not*: the build
 * pre-sums and pre-ranks one shard per (院系 × 届 × 学历) precisely so the
 * client never has to add masked buckets together, which used to bury 14,377
 * 人 in 「其他」 on the default view. All this file does with detail rows is
 * decode them and drop the 去向 the reader filtered out.
 */
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
  gradeOf: new Map(manifest.grades.map((g, i) => [g, i])),
  educationOf: new Map(manifest.educations.map((e, i) => [e, i])),
  categoryOf: new Map(manifest.categories.map((c, i) => [c, i])),
  collegeOf: new Map(manifest.colleges.map((c, i) => [c.id, i])),
});

/** `null` scope facet matches everything; an unknown value matches nothing. */
const wanted = <T>(value: T | null, lookup: Map<T, number>): number | null => {
  if (value === null) return null;
  return lookup.get(value) ?? -1;
};

export type CategoryTotal = {
  category: string;
  people: number;
  /** Distinct 单位 before masking — a spread indicator, carries no names. */
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

  const people = new Array<number>(manifest.categories.length).fill(0);
  const orgs = new Array<number>(manifest.categories.length).fill(0);
  for (const [c, g, e, k, p, n] of overview.cells) {
    if (college !== null && c !== college) continue;
    if (grade !== null && g !== grade) continue;
    if (education !== null && e !== education) continue;
    people[k] = (people[k] ?? 0) + p;
    orgs[k] = (orgs[k] ?? 0) + n;
  }
  return manifest.categories
    .map((category, k) => ({
      category,
      people: people[k] ?? 0,
      orgCount: orgs[k] ?? 0,
    }))
    .filter((row) => row.people > 0);
};

export type GradePoint = {
  grade: number;
  people: number;
  /** Headcount per category, indexed like manifest.categories. */
  byCategory: number[];
};

/** Oldest 届 first, so a chart can read it left to right. */
export const gradeTrend = (
  overview: GraduationOverview,
  manifest: GraduationManifest,
  indices: Indices,
  scope: Scope,
): GradePoint[] => {
  const college = wanted(scope.collegeId, indices.collegeOf);
  const education = wanted(scope.education, indices.educationOf);

  const points = manifest.grades.map((grade) => ({
    grade,
    people: 0,
    byCategory: new Array<number>(manifest.categories.length).fill(0),
  }));
  for (const [c, g, e, k, p] of overview.cells) {
    if (college !== null && c !== college) continue;
    if (education !== null && e !== education) continue;
    const point = points[g];
    if (!point) continue;
    point.people += p;
    point.byCategory[k] = (point.byCategory[k] ?? 0) + p;
  }
  return points.filter((point) => point.people > 0).reverse();
};

export type OrgTotal = {
  org: string;
  /** Which 去向 this count belongs to — 升学 院校 and 就业 单位 rank together
   *  in one list, so each row has to say which kind of number it is. */
  category: string;
  people: number;
};

/**
 * Flattens the fetched pages into display rows, keeping the build's ranking.
 * Filtering by 去向 preserves relative order, so no re-sort is needed — which
 * is what lets the list page by rank at all.
 */
export const detailRows = (
  pages: DetailPage[],
  manifest: GraduationManifest,
  indices: Indices,
  scope: Scope,
): OrgTotal[] => {
  const category = wanted(scope.category, indices.categoryOf);
  const out: OrgTotal[] = [];
  for (const page of pages) {
    for (const [orgIdx, catIdx, people] of page.rows) {
      if (category !== null && catIdx !== category) continue;
      const org = page.orgs[orgIdx];
      if (org === undefined) continue;
      out.push({
        org,
        category: manifest.categories[catIdx] ?? '',
        people,
      });
    }
  }
  return out;
};

/** People the threshold withheld, for the footer — never a ranked row. */
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
