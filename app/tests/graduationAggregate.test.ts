import { describe, expect, it } from 'vite-plus/test';
import type {
  DetailPage,
  GraduationManifest,
  GraduationOverview,
  Scope,
} from '~/pages/academic/graduation/types';
import {
  buildIndices,
  categoryTotals,
  detailRows,
  gradeTrend,
  maskedTotals,
} from '~/pages/academic/graduation/utils/aggregate';

const manifest: GraduationManifest = {
  generatedAt: '2026-09-11T00:00:00.000Z',
  source: 'https://example.invalid',
  policy: {
    maskThreshold: 2,
    maskExempt: ['升学'],
    maskLabel: '其他',
    note: '',
  },
  corrections: [],
  detail: { pageBudget: 10240, all: 'all' },
  grades: [2023, 2022],
  educations: ['本科', '硕士'],
  categories: ['就业', '升学'],
  colleges: [
    { id: '128', name: '机械', people: 1 },
    { id: '124', name: '计算机', people: 1 },
  ],
  stats: {
    rawRows: 1,
    people: 1,
    colleges: 2,
    overviewCells: 1,
    detailFiles: 1,
  },
};

const indices = buildIndices(manifest);

// [collegeIdx, gradeIdx, educationIdx, categoryIdx, people, orgCount]
const overview: GraduationOverview = {
  cells: [
    [0, 0, 0, 0, 100, 40],
    [0, 0, 0, 1, 60, 10],
    [0, 1, 0, 0, 90, 35],
    [0, 0, 1, 0, 30, 12],
    [1, 0, 0, 0, 200, 50],
  ],
};

const ALL: Scope = {
  collegeId: null,
  grade: null,
  education: null,
  category: null,
};

describe('categoryTotals', () => {
  it('sums every college when the scope has no college', () => {
    const rows = categoryTotals(overview, manifest, indices, ALL);
    expect(rows).toEqual([
      { category: '就业', people: 420, orgCount: 137 },
      { category: '升学', people: 60, orgCount: 10 },
    ]);
  });

  it('narrows to one college and 学历', () => {
    const rows = categoryTotals(overview, manifest, indices, {
      ...ALL,
      collegeId: '128',
      education: '本科',
    });
    expect(rows).toEqual([
      { category: '就业', people: 190, orgCount: 75 },
      { category: '升学', people: 60, orgCount: 10 },
    ]);
  });

  it('drops categories with nobody in them', () => {
    const rows = categoryTotals(overview, manifest, indices, {
      ...ALL,
      collegeId: '124',
    });
    expect(rows.map((r) => r.category)).toEqual(['就业']);
  });

  it('returns nothing for a college outside the manifest', () => {
    expect(
      categoryTotals(overview, manifest, indices, { ...ALL, collegeId: '999' }),
    ).toEqual([]);
  });
});

describe('gradeTrend', () => {
  it('runs oldest 届 first and skips empty ones', () => {
    const points = gradeTrend(overview, manifest, indices, {
      ...ALL,
      collegeId: '128',
    });
    expect(points.map((p) => [p.grade, p.people])).toEqual([
      [2022, 90],
      [2023, 190],
    ]);
  });

  it('ignores the category facet, which a trend splits by itself', () => {
    const withCategory = gradeTrend(overview, manifest, indices, {
      ...ALL,
      collegeId: '128',
      category: '升学',
    });
    expect(withCategory).toEqual(
      gradeTrend(overview, manifest, indices, { ...ALL, collegeId: '128' }),
    );
  });
});

// Pre-ranked by the build; each page carries only the names it references, so
// the same 单位 can hold a different index on a later page.
// [orgIdx, categoryIdx, people]
const page0: DetailPage = {
  hasMore: true,
  masked: [
    [0, 320],
    [1, 4],
  ],
  orgs: ['重庆大学', '比亚迪'],
  rows: [
    [0, 1, 70],
    [1, 0, 30],
    [0, 0, 12],
  ],
};
const page1: DetailPage = {
  orgs: ['长安汽车', '华为'],
  rows: [
    [0, 0, 9],
    [1, 0, 8],
  ],
};

describe('detailRows', () => {
  it('concatenates pages and keeps the build ranking', () => {
    const rows = detailRows([page0, page1], manifest, indices, ALL);
    expect(rows.map((r) => [r.org, r.category, r.people])).toEqual([
      ['重庆大学', '升学', 70],
      ['比亚迪', '就业', 30],
      ['重庆大学', '就业', 12],
      ['长安汽车', '就业', 9],
      ['华为', '就业', 8],
    ]);
  });

  it('resolves each page against its own name table', () => {
    // orgIdx 0 means 重庆大学 on page 0 and 长安汽车 on page 1.
    const rows = detailRows([page0, page1], manifest, indices, ALL);
    expect(rows[0]?.org).toBe('重庆大学');
    expect(rows[3]?.org).toBe('长安汽车');
  });

  it('filters 去向 without disturbing relative order', () => {
    const rows = detailRows([page0, page1], manifest, indices, {
      ...ALL,
      category: '就业',
    });
    expect(rows.map((r) => r.people)).toEqual([30, 12, 9, 8]);
  });

  it('never folds one 单位 that appears under two 去向', () => {
    const rows = detailRows([page0], manifest, indices, ALL);
    const cqu = rows.filter((r) => r.org === '重庆大学');
    expect(cqu.map((r) => [r.category, r.people])).toEqual([
      ['升学', 70],
      ['就业', 12],
    ]);
  });

  it('matches nothing for a 去向 outside the manifest', () => {
    expect(
      detailRows([page0], manifest, indices, { ...ALL, category: '村官计划' }),
    ).toEqual([]);
  });

  it('handles a scope whose pages have not arrived yet', () => {
    expect(detailRows([], manifest, indices, ALL)).toEqual([]);
  });
});

describe('maskedTotals', () => {
  it('reads the residual from page 0 only', () => {
    expect(maskedTotals([page0, page1], manifest, indices, ALL)).toEqual([
      { category: '就业', people: 320 },
      { category: '升学', people: 4 },
    ]);
  });

  it('narrows to the selected 去向', () => {
    expect(
      maskedTotals([page0], manifest, indices, { ...ALL, category: '就业' }),
    ).toEqual([{ category: '就业', people: 320 }]);
  });

  it('reports nothing when no page has landed', () => {
    expect(maskedTotals([], manifest, indices, ALL)).toEqual([]);
  });

  // A small 院系 × 届 × 学历 slice where every 单位 took one person ranks
  // nothing, and the build still ships a page so the client sees a real answer.
  it('still reports the residual for a view that ranks nothing', () => {
    const allWithheld: DetailPage = { masked: [[0, 10]], orgs: [], rows: [] };
    expect(detailRows([allWithheld], manifest, indices, ALL)).toEqual([]);
    expect(maskedTotals([allWithheld], manifest, indices, ALL)).toEqual([
      { category: '就业', people: 10 },
    ]);
  });
});
