/**
 * Shapes of the chunks under public/data/graduation, produced by
 * pnpm graduation:build. Everything is dictionary-encoded against the index
 * arrays in the manifest so the shards stay small over the wire.
 */

export type GraduationPolicy = {
  maskThreshold: number;
  maskExempt: string[];
  maskLabel: string;
  note: string;
};

export type CollegeMeta = {
  id: string;
  name: string;
  people: number;
};

/** A place the source classified something on its own terms wrongly. */
export type GraduationCorrection = {
  org: string;
  from: string;
  to: string;
  why: string;
  rows: number;
  people: number;
};

export type GraduationManifest = {
  generatedAt: string;
  source: string;
  policy: GraduationPolicy;
  corrections: GraduationCorrection[];
  /** Shard geometry for the detail pages. */
  detail: { pageBudget: number; all: string };
  /** Newest 届 first. */
  grades: number[];
  educations: string[];
  categories: string[];
  colleges: CollegeMeta[];
  stats: {
    rawRows: number;
    people: number;
    colleges: number;
    overviewCells: number;
    detailFiles: number;
  };
};

/** [collegeIdx, gradeIdx, educationIdx, categoryIdx, people, orgCount] */
export type OverviewCell = [number, number, number, number, number, number];

export type GraduationOverview = { cells: OverviewCell[] };

/** [orgIdx, categoryIdx, people] — already summed and ranked by the build. */
export type DetailRow = [number, number, number];

/**
 * A (院系 × 届 × 学历) ranking, or one slice of it. Most views fit the build's
 * size budget and arrive as a single page that says nothing about paging.
 */
export type DetailPage = {
  /** Present only while a further page exists — the paging loop's only signal. */
  hasMore?: boolean;
  /** [categoryIdx, people] the threshold withheld; page 0 only. */
  masked?: Array<[number, number]>;
  orgs: string[];
  rows: DetailRow[];
};

/** `null` college means the school-wide scope. */
export type Scope = {
  collegeId: string | null;
  grade: number | null;
  education: string | null;
  category: string | null;
};
