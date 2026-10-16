export type SortDir = "asc" | "desc";
export type SortVal = string | number | null | undefined;

/** Stable sort; numbers numerically, strings with locale compare (numeric aware); empty values always last. */
export function sortRows<T>(rows: readonly T[], get: (r: T) => SortVal, dir: SortDir, locale = "es"): T[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a), y = get(b);
    const ex = x === null || x === undefined || x === "", ey = y === null || y === undefined || y === "";
    if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * m;
    return String(x).localeCompare(String(y), locale, { numeric: true, sensitivity: "base" }) * m;
  });
}

/** First click on a new column sorts ascending; clicking the same column toggles. */
export function nextSort<K>(cur: { key: K; dir: SortDir }, key: K): { key: K; dir: SortDir } {
  return cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}
