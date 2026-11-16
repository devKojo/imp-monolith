// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pageCount, pageSlice } from './paginate';

const items = Array.from({ length: 23 }, (_, i) => i + 1);

describe('pageCount', () => {
  it('is at least one page, and rounds up', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(10)).toBe(1);
    expect(pageCount(11)).toBe(2);
    expect(pageCount(23, 5)).toBe(5);
  });
});

describe('pageSlice', () => {
  it('returns the items of one page', () => {
    expect(pageSlice(items, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pageSlice(items, 3)).toEqual([21, 22, 23]);
    expect(pageSlice(items, 2, 5)).toEqual([6, 7, 8, 9, 10]);
  });

  it('never leaves the reader on an empty page', () => {
    expect(pageSlice(items, 9)).toEqual([21, 22, 23]);
    expect(pageSlice(items, 0)).toEqual(pageSlice(items, 1));
    expect(pageSlice([], 4)).toEqual([]);
  });
});
