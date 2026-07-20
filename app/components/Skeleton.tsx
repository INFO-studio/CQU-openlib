import type { CSSProperties } from 'react';
import { cn } from '~/lib/cn';

type BoneProps = {
  className?: string;
  style?: CSSProperties;
};
export const Bone = ({ className, style }: BoneProps) => {
  return <span className={cn('docs-skeleton-bone', className)} style={style} />;
};
export const NavSkeleton = ({ course = false }: { course?: boolean }) => {
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 py-1"
      aria-busy
      aria-label="目录加载中"
    >
      <Bone className="h-4 w-16" />
      {course ? (
        <div className="grid grid-cols-9 gap-1 rounded-md bg-mist/80 p-1.5">
          {Array.from({ length: 27 }, (_, i) => (
            <Bone key={i} className="h-5 w-full rounded" />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {Array.from({ length: course ? 8 : 10 }, (_, i) => (
          <Bone
            key={i}
            className="h-3.5"
            style={{ width: `${58 + ((i * 17) % 35)}%` }}
          />
        ))}
      </div>
    </div>
  );
};
export const DocSkeleton = () => {
  return (
    <div className="docs-prose min-w-0" aria-busy aria-label="文档加载中">
      <Bone className="mb-4 h-8 w-[min(18rem,70%)]" />
      <div className="flex flex-col gap-3">
        <Bone className="h-3.5 w-full" />
        <Bone className="h-3.5 w-[94%]" />
        <Bone className="h-3.5 w-[88%]" />
        <Bone className="mt-2 h-3.5 w-full" />
        <Bone className="h-3.5 w-[91%]" />
        <Bone className="h-3.5 w-[76%]" />
        <Bone className="mt-4 h-24 w-full rounded-md" />
        <Bone className="mt-2 h-3.5 w-[85%]" />
        <Bone className="h-3.5 w-[92%]" />
        <Bone className="h-3.5 w-[60%]" />
      </div>
    </div>
  );
};
export const SearchSkeleton = ({ rows = 5 }: { rows?: number }) => {
  return (
    <ul className="flex flex-col gap-1 p-1.5" aria-busy aria-label="搜索中">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex items-baseline justify-between gap-3 px-2.5 py-2"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone
              className="h-3.5"
              style={{ width: `${55 + (i % 4) * 10}%` }}
            />
            <Bone
              className="h-2.5"
              style={{ width: `${40 + (i % 3) * 12}%` }}
            />
          </div>
          <Bone className="h-2.5 w-10 shrink-0" />
        </li>
      ))}
    </ul>
  );
};
