/** Rows per page in the console tables. */
export const CONSOLE_PAGE_SIZE = 10;

/** Number of pages for `total` items, never less than one. */
export const pageCount = (total: number, size: number = CONSOLE_PAGE_SIZE): number =>
  Math.max(1, Math.ceil(total / size));

/**
 * The items on one page (pages count from 1). A page past the end shows the last page, so a list that
 * shrinks (a filter, a deletion) never leaves the reader on an empty page.
 */
export function pageSlice<T>(
  items: readonly T[],
  page: number,
  size: number = CONSOLE_PAGE_SIZE,
): T[] {
  const p = Math.min(Math.max(1, page), pageCount(items.length, size));
  return items.slice((p - 1) * size, p * size);
}
