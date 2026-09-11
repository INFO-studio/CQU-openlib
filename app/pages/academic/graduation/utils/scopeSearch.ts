/**
 * The scope lives in the URL so a 学院 view can be linked to directly. Values
 * are validated against the manifest only after it loads; here we just keep the
 * shape honest, mirroring app/pages/map/utils/mapSearch.ts.
 */
import type { Scope } from '../types';

export type GraduationSearch = {
  college?: string;
  edu?: string;
  grade?: number;
  cat?: string;
};

const text = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const validateGraduationSearch = (
  search: Record<string, unknown>,
): GraduationSearch => {
  const out: GraduationSearch = {};
  const college = text(search.college);
  if (college) out.college = college;
  const edu = text(search.edu);
  if (edu) out.edu = edu;
  const cat = text(search.cat);
  if (cat) out.cat = cat;
  const grade = Number(search.grade);
  if (Number.isInteger(grade) && grade >= 1900 && grade <= 2200)
    out.grade = grade;
  return out;
};

/** Drops empty facets so a default view keeps a clean URL. */
export const buildGraduationSearch = (scope: Scope): GraduationSearch => {
  const out: GraduationSearch = {};
  if (scope.collegeId) out.college = scope.collegeId;
  if (scope.education) out.edu = scope.education;
  if (scope.grade !== null) out.grade = scope.grade;
  if (scope.category) out.cat = scope.category;
  return out;
};

export const scopeFromSearch = (search: GraduationSearch): Scope => ({
  collegeId: search.college ?? null,
  education: search.edu ?? null,
  grade: search.grade ?? null,
  category: search.cat ?? null,
});

export const EMPTY_SCOPE: Scope = {
  collegeId: null,
  education: null,
  grade: null,
  category: null,
};

export const isScopeEmpty = (scope: Scope): boolean =>
  scope.collegeId === null &&
  scope.education === null &&
  scope.grade === null &&
  scope.category === null;
