import { Dialog } from '@base-ui/react/dialog';
import { ListFilter, Search, X } from 'lucide-react';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import { SelectField, type SelectOption } from '~/components/ui/select';
import { cn } from '~/lib/cn';
import { MAP_ITEM_CATEGORIES } from '../data';
import { MapCategoryIcon } from '../markerIcons';
import type { CampusDataStatus, CategoryFilter, MapItem } from '../type';

const CATEGORY_OPTIONS: readonly SelectOption<CategoryFilter>[] = [
  {
    value: 'all',
    label: '全部分类',
    icon: (
      <ListFilter size={14} strokeWidth={1.8} className="text-icon-strong" />
    ),
  },
  ...MAP_ITEM_CATEGORIES.map((category) => ({
    value: category.id,
    label: category.label,
    icon: (
      <MapCategoryIcon
        category={category.id}
        size={14}
        className="text-icon-strong"
      />
    ),
  })),
];

const MapItemList = ({
  items,
  selected,
  status,
  onSelect,
}: {
  items: readonly MapItem[];
  selected: MapItem | null;
  status: CampusDataStatus;
  onSelect: (item: MapItem) => void;
}) => (
  <div className="min-h-0 flex-1 overflow-y-auto">
    {status === 'loading' ? (
      <div className="grid place-items-center px-6 py-10">
        <ActivitySpinner size={22} label="加载地点" />
      </div>
    ) : status === 'error' ? (
      <div className="px-6 py-10 text-center">
        <p className="m-0 font-medium text-ink">地点数据加载失败</p>
        <p className="mt-1 mb-0 text-xs text-muted">请刷新页面后重试</p>
      </div>
    ) : items.length ? (
      items.map((item) => {
        const active = selected?.id === item.id;
        return (
          <button
            type="button"
            key={item.id}
            className={cn(
              'flex w-full items-start gap-3 border-b border-line px-3 py-2.5 text-left transition-colors',
              active ? 'bg-primary-faint' : 'bg-panel hover:bg-mist',
            )}
            onClick={() => onSelect(item)}
          >
            <MapCategoryIcon
              category={item.category}
              size={17}
              className="mt-0.5 shrink-0 text-icon-strong"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug text-ink">
                {item.name}
              </span>
              {item.desc ? (
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted">
                  {item.desc}
                </span>
              ) : null}
            </span>
          </button>
        );
      })
    ) : (
      <div className="px-6 py-10 text-center">
        <ListFilter
          size={22}
          className="mx-auto text-icon-strong"
          aria-hidden
        />
        <p className="mt-3 mb-0 font-medium text-ink">没有匹配的地点</p>
        <p className="mt-1 mb-0 text-xs text-muted">换个关键词或分类试试</p>
      </div>
    )}
  </div>
);

const MapSidebarContent = ({
  items,
  selected,
  status,
  query,
  category,
  mobile,
  onQueryChange,
  onCategoryChange,
  onSelect,
}: {
  items: readonly MapItem[];
  selected: MapItem | null;
  status: CampusDataStatus;
  query: string;
  category: CategoryFilter;
  mobile: boolean;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onSelect: (item: MapItem) => void;
}) => (
  <>
    {mobile ? (
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-xs font-medium text-muted">校园地点</span>
        <Dialog.Close
          className="grid h-8 w-8 place-items-center rounded-md text-icon-strong hover:bg-mist"
          aria-label="关闭地点列表"
        >
          <X size={16} />
        </Dialog.Close>
      </div>
    ) : null}
    <div className="flex gap-2 border-b border-line p-3">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 focus-within:border-primary">
        <Search size={15} className="shrink-0 text-icon-strong" aria-hidden />
        <span className="sr-only">搜索地点</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索"
          className="min-w-0 flex-1 text-sm placeholder:text-muted"
        />
        {query ? (
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded-md text-icon-strong hover:bg-mist"
            aria-label="清空搜索"
            onClick={() => onQueryChange('')}
          >
            <X size={13} />
          </button>
        ) : null}
      </label>
      <SelectField
        value={category}
        options={CATEGORY_OPTIONS}
        onValueChange={onCategoryChange}
        ariaLabel="地点分类"
        className="w-32 bg-paper text-xs md:w-36"
      />
    </div>
    <MapItemList
      items={items}
      selected={selected}
      status={status}
      onSelect={onSelect}
    />
  </>
);

export default MapSidebarContent;
