import type { CategoryFilter, MapItem } from '../type';

export const filterMapItems = (
  items: readonly MapItem[],
  category: CategoryFilter,
  query: string,
): readonly MapItem[] => {
  const keyword = query.trim().toLocaleLowerCase('zh-CN');
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (!keyword) return true;
    const commentText =
      item.comment
        ?.map(
          (comment) =>
            `${comment.author ?? ''} ${comment.detail} ${comment.rate ?? ''}`,
        )
        .join(' ') ?? '';
    return `${item.name} ${item.desc ?? ''} ${commentText}`
      .toLocaleLowerCase('zh-CN')
      .includes(keyword);
  });
};
