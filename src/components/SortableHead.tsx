import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { nextSort, type SortDir } from "@/lib/sort";

export function useSort<K extends string>(key: K, dir: SortDir = "asc") {
  const [s, setS] = useState<{ key: K; dir: SortDir }>({ key, dir });
  return { ...s, toggle: (k: K) => setS((c) => nextSort(c, k)) };
}

/** Clickable header label; place inside a th / TableHead. */
export function SortButton<K extends string>({ k, sort, children, center }: { k: K; sort: { key: K; dir: SortDir; toggle: (k: K) => void }; children: ReactNode; center?: boolean }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => sort.toggle(k)} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`inline-flex items-center gap-1 hover:text-foreground ${center ? "justify-center" : ""} ${active ? "text-foreground" : ""}`}>
      {children}<Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} />
    </button>
  );
}
