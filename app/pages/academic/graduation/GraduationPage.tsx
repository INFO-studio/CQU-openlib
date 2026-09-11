import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import DocLink from '~/components/DocLink';
import DocsShell from '~/components/DocsShell';
import { InfoPopover } from '~/components/ui/info-popover';
import { Bone } from '~/components/ui/skeleton';
import { useTitle } from '~/hooks/useTitle';
import {
  graduationDetailQueryOptions,
  graduationManifestQueryOptions,
  graduationOverviewQueryOptions,
} from '~/queries/graduation';
import CategoryDonut from './components/CategoryDonut';
import GradeTrend from './components/GradeTrend';
import OrgList, { PAGE_SIZE } from './components/OrgList';
import ScopeBar from './components/ScopeBar';
import type { Scope } from './types';
import {
  buildIndices,
  categoryTotals,
  detailRows,
  gradeTrend,
  maskedTotals,
} from './utils/aggregate';
import { buildGraduationSearch, scopeFromSearch } from './utils/scopeSearch';

const ROUTE = '/academic/graduation' as const;

const Panel = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h2 className="m-0 text-xs font-semibold tracking-wide text-muted uppercase">
      {label}
    </h2>
    {children}
  </section>
);

const GraduationPage = () => {
  const search = useSearch({ from: ROUTE });
  const navigate = useNavigate({ from: ROUTE });
  const scope = useMemo<Scope>(() => scopeFromSearch(search), [search]);
  const [shown, setShown] = useState(PAGE_SIZE);

  useTitle('毕业去向');

  const manifestQuery = useQuery(graduationManifestQueryOptions());
  const overviewQuery = useQuery(graduationOverviewQueryOptions());

  const manifest = manifestQuery.data;
  const indices = useMemo(
    () => (manifest ? buildIndices(manifest) : null),
    [manifest],
  );

  // 去向 is filtered client-side, so it must not enter the shard key or every
  // category switch would cost a request for identical numbers.
  const detailQuery = useInfiniteQuery({
    ...graduationDetailQueryOptions(
      scope.collegeId,
      scope.grade,
      scope.education === null
        ? null
        : (indices?.educationOf.get(scope.education) ?? null),
    ),
    enabled: Boolean(manifest),
  });
  const detailPages = detailQuery.data?.pages ?? [];

  const totals = useMemo(
    () =>
      manifest && indices && overviewQuery.data
        ? categoryTotals(overviewQuery.data, manifest, indices, scope)
        : [],
    [manifest, indices, overviewQuery.data, scope],
  );
  const trend = useMemo(
    () =>
      manifest && indices && overviewQuery.data
        ? gradeTrend(overviewQuery.data, manifest, indices, scope)
        : [],
    [manifest, indices, overviewQuery.data, scope],
  );
  const orgRows = useMemo(
    () =>
      manifest && indices
        ? detailRows(detailPages, manifest, indices, scope)
        : [],
    [manifest, indices, detailPages, scope],
  );
  const withheld = useMemo(
    () =>
      manifest && indices
        ? maskedTotals(detailPages, manifest, indices, scope)
        : [],
    [manifest, indices, detailPages, scope],
  );

  // A new filter should start from the top of the list, not mid-scroll.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [scope]);

  const applyScope = (next: Scope) => {
    void navigate({ search: buildGraduationSearch(next) });
  };

  if (manifestQuery.isError) {
    return (
      <DocsShell>
        <div className="docs-prose">
          <h1>毕业去向</h1>
          <p className="text-sm text-error">数据加载失败，请刷新重试。</p>
        </div>
      </DocsShell>
    );
  }

  if (!manifest) {
    return (
      <DocsShell>
        <div className="docs-prose min-w-0">
          <h1>毕业去向</h1>
          <Bone className="h-10 w-full rounded-md" />
          <Bone className="mt-5 h-64 w-full rounded-md" />
        </div>
      </DocsShell>
    );
  }

  const collegeName = manifest.colleges.find(
    (c) => c.id === scope.collegeId,
  )?.name;
  const people = totals.reduce((sum, row) => sum + row.people, 0);

  return (
    <DocsShell>
      <div className="docs-prose min-w-0">
        <div className="docs-title-row">
          <h1>毕业去向</h1>
          <InfoPopover ariaLabel="查看毕业去向数据来源">
            <p className="m-0 leading-relaxed text-muted">
              本页孵化自{' '}
              <a
                href="https://github.com/ZCZZENG/CQU---Graduate-Employment-Destination-Inquiry"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary no-underline hover:underline"
              >
                CQU---Graduate-Employment-Destination-Inquiry
              </a>
              <span className="mx-1 text-muted">@</span>
              <DocLink
                path="/contributor/ZCZZENG"
                className="font-medium text-primary no-underline hover:underline"
              >
                ZCZZENG
              </DocLink>
            </p>
            <p className="mt-2 m-0 text-[0.8125rem] leading-relaxed text-muted">
              数据来自{' '}
              <a
                href={manifest.source}
                target="_blank"
                rel="noreferrer"
                className="text-primary no-underline hover:underline"
              >
                就业信息网「往届生查询」
              </a>
              ，{manifest.grades.at(-1)}–{manifest.grades[0]}{' '}
              届，按单位汇总，不含姓名、学号、专业。
            </p>
          </InfoPopover>
        </div>

        {/* Filters stay put: they drive both columns below them. The negative
            margin cancels the shell's own gutter so the bar reaches the screen
            edges, but only while main spans the full width — from lg on it
            would bleed into the sidebar gutter instead. */}
        <div className="sticky top-header z-20 -mx-3 flex h-14 items-center border-b border-line bg-paper/88 px-3 backdrop-blur-sm md:-mx-5 md:px-5 lg:mx-0 lg:px-0">
          <ScopeBar manifest={manifest} scope={scope} onChange={applyScope} />
        </div>

        {/* Both columns carry their own top padding rather than inheriting a
            grid margin, so the sticky aside keeps that padding while pinned
            instead of jamming against the filter bar. */}
        <div className="grid items-start gap-x-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
          {/* Capped and centred below lg: the panels are laid out for a 14rem
              column, so spanning a tablet's full width only stretches the rows,
              and left-aligning that narrow block reads like a mistake. */}
          <aside className="mx-auto flex w-full min-w-0 max-w-[22rem] flex-col gap-6 bg-paper pt-5 lg:mx-0 lg:max-w-none lg:sticky lg:top-[calc(var(--layout-header)+3.5rem)] lg:order-2">
            <div className="flex flex-col">
              <span className="text-[1.75rem] leading-none font-semibold text-ink tabular-nums">
                {people.toLocaleString('zh-CN')}
                <span className="ml-1 text-base font-medium text-muted">
                  人
                </span>
              </span>
              <span className="mt-1.5 text-xs leading-relaxed text-muted">
                {collegeName ?? '全部院系'} · {scope.education ?? '全部学历'} ·{' '}
                {scope.grade === null ? '全部届次' : `${scope.grade} 届`}
              </span>
            </div>

            {overviewQuery.data ? (
              <>
                <Panel label="去向占比">
                  <CategoryDonut
                    totals={totals}
                    activeCategory={scope.category}
                    onSelectCategory={(category) =>
                      applyScope({ ...scope, category })
                    }
                  />
                </Panel>
                {trend.length >= 2 ? (
                  <Panel label="逐届变化">
                    <GradeTrend
                      points={trend}
                      categories={manifest.categories}
                      activeGrade={scope.grade}
                      onSelectGrade={(grade) => applyScope({ ...scope, grade })}
                    />
                  </Panel>
                ) : null}
              </>
            ) : (
              <Bone className="h-56 w-full rounded-md" />
            )}
          </aside>

          <div className="min-w-0 pt-5 lg:order-1">
            <h2 className="m-0 text-base">
              {scope.category === '升学' ? '录取院校' : '去向单位'}
            </h2>
            <OrgList
              rows={orgRows}
              shown={shown}
              loading={detailQuery.isPending}
              hasMore={detailQuery.hasNextPage}
              total={people}
              showCategory={scope.category === null}
              withheld={withheld}
              onReveal={() => setShown((n) => n + PAGE_SIZE)}
              onFetchMore={() => void detailQuery.fetchNextPage()}
            />
          </div>
        </div>
      </div>
    </DocsShell>
  );
};

export default GraduationPage;
