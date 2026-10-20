export type PageItem = number | "gap";

/**
 * Page numbers to show in a pager: all of them up to seven, otherwise the first,
 * the last and the current one with its neighbours, gaps marked.
 */
export function pageItems(current: number, count: number): PageItem[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const keep = new Set([1, count, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (current >= count - 2) [count - 3, count - 2, count - 1].forEach((n) => keep.add(n));
  const pages = [...keep].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const items: PageItem[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1]! > 1) items.push("gap");
    items.push(n);
  });
  return items;
}

/** A positive whole page number from a search param, or 1. */
export function pageParam(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
