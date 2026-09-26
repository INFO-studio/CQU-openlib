import parse from 'html-react-parser';
import { lazy, type ReactNode, Suspense } from 'react';
import HomeBookmarks from '~/components/HomeBookmarks';
import type { MnHtml } from '~/types/mdast';

const BusTimeTable = lazy(() => import('~/components/doc/BusTimeTable'));

type DocComponent = {
  render: () => ReactNode;
  fallback?: ReactNode;
};

const DOC_COMPONENTS: Record<string, DocComponent> = {
  BusTimeTable: {
    fallback: (
      <div className="my-2 flex flex-col gap-4" aria-label="校车时刻表加载中">
        <div className="h-14 animate-pulse rounded-md bg-mist motion-reduce:animate-none" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-md bg-mist motion-reduce:animate-none" />
          <div className="h-24 animate-pulse rounded-md bg-mist motion-reduce:animate-none" />
        </div>
        <div className="h-48 animate-pulse rounded-md bg-mist motion-reduce:animate-none" />
      </div>
    ),
    render: () => <BusTimeTable />,
  },
  HomeBookmarks: { render: () => <HomeBookmarks /> },
};

const COMPONENT_TAG = /^<([A-Z][A-Za-z0-9]*)\s*\/>\s*$/;

const parserHtml = (mn: MnHtml) => {
  const match = mn.value.trim().match(COMPONENT_TAG);
  if (!match) return <>{parse(mn.value)}</>;

  const component = DOC_COMPONENTS[match[1]!];
  if (!component) return <>{parse(mn.value)}</>;
  return (
    <Suspense fallback={component.fallback ?? null}>
      {component.render()}
    </Suspense>
  );
};

export default parserHtml;
