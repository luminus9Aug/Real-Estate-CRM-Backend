export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export function buildCursorPaginationMeta<T extends { id: string }>(
  items: T[],
  take: number,
): CursorPaginationMeta {
  const hasMore = items.length > take;
  const slice = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;
  return { nextCursor, hasMore };
}
