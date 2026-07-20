import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import DocLink from '~/components/DocLink';
import { cn } from '~/lib/cn';
import type { SidebarNode } from '~/lib/nav';
import { useSidebarStore } from '~/stores/sidebarStore';

type Props = {
  title: string;
  sectionPath: string;
  tree: SidebarNode[];
  currentPath: string;
  onNavigate?: () => void;
};

const TreeNode = ({
  node,
  currentPath,
  onNavigate,
  depth,
}: {
  node: SidebarNode;
  currentPath: string;
  onNavigate?: () => void;
  depth: number;
}) => {
  const { isExpanded, setOpen } = useSidebarStore();
  const hasChildren = Boolean(node.children?.length);
  const active =
    currentPath === node.path || currentPath.startsWith(`${node.path}/`);
  const open = isExpanded(node.path);

  const linkClass = cn(
    'min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-[0.8125rem] no-underline transition-colors',
    active
      ? 'bg-primary-soft font-medium text-ink'
      : 'text-muted hover:bg-mist hover:text-ink',
  );

  const row = (
    <div
      className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-0.5"
      style={{ paddingLeft: `${depth * 0.7}rem` }}
    >
      {hasChildren ? (
        <Collapsible.Trigger
          className="inline-flex h-5 w-5 items-center justify-center rounded text-icon hover:bg-mist hover:text-ink"
          aria-label={open ? '折叠' : '展开'}
        >
          <ChevronRight
            size={14}
            className={cn(
              'transition-transform duration-150',
              open ? 'rotate-90' : undefined,
            )}
          />
        </Collapsible.Trigger>
      ) : (
        <span aria-hidden className="h-5 w-5" />
      )}
      <DocLink
        path={node.path}
        onNavigate={() => {
          if (hasChildren) setOpen(node.path, true);
          onNavigate?.();
        }}
        className={linkClass}
      >
        {node.title}
      </DocLink>
    </div>
  );

  if (!hasChildren) {
    return <li>{row}</li>;
  }

  return (
    <li>
      <Collapsible.Root
        open={open}
        onOpenChange={(next) => setOpen(node.path, next)}
      >
        {row}
        <Collapsible.Panel>
          <ul className="mt-0.5 flex flex-col gap-px">
            {node.children?.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                currentPath={currentPath}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
          </ul>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
};

const Sidebar = ({
  title,
  sectionPath,
  tree,
  currentPath,
  onNavigate,
}: Props) => {
  const { ensureAncestorsOpen } = useSidebarStore();

  useEffect(() => {
    ensureAncestorsOpen(currentPath);
  }, [currentPath, ensureAncestorsOpen]);

  return (
    <nav aria-label="章节目录" className="docs-nav flex flex-col gap-2">
      <DocLink
        path={sectionPath}
        onNavigate={onNavigate}
        className="text-sm font-semibold text-ink no-underline hover:text-primary"
      >
        {title}
      </DocLink>
      <ul className="flex flex-col gap-px">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            currentPath={currentPath}
            onNavigate={onNavigate}
            depth={0}
          />
        ))}
      </ul>
    </nav>
  );
};
export default Sidebar;
