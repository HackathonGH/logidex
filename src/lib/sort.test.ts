import { describe, it, expect } from "vitest";
import { sortRows, nextSort } from "./sort";

describe("sortRows", () => {
  it("sorts numbers ascending and descending", () => {
    expect(sortRows([3, 1, 2], (x) => x, "asc")).toEqual([1, 2, 3]);
    expect(sortRows([3, 1, 2], (x) => x, "desc")).toEqual([3, 2, 1]);
  });
  it("sorts ISO dates descending with latest first", () => {
    const r = sortRows(["2026-10-01T08:00Z", "2026-10-16T08:00Z", "2026-10-05T08:00Z"], (x) => x, "desc");
    expect(r[0]).toBe("2026-10-16T08:00Z");
  });
  it("puts empty values last in both directions", () => {
    expect(sortRows(["b", "", "a"], (x) => x, "asc")).toEqual(["a", "b", ""]);
    expect(sortRows(["b", "", "a"], (x) => x, "desc")).toEqual(["b", "a", ""]);
  });
});

describe("nextSort", () => {
  it("first click ascending, second click descending", () => {
    const a = nextSort({ key: "date", dir: "desc" as const }, "code");
    expect(a).toEqual({ key: "code", dir: "asc" });
    expect(nextSort(a, "code")).toEqual({ key: "code", dir: "desc" });
  });
});
