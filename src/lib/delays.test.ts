import { describe, it, expect } from "vitest";
import { isDelayed, computeKpis, type KpiRow } from "./reservations";

const start = "2026-10-15T08:00:00Z";
describe("delay alert at +15 min", () => {
  it("alerts only from 15 minutes after the scheduled time without arrival", () => {
    expect(isDelayed({ status: "confirmed", starts_at: start }, new Date("2026-10-15T08:14:59Z"))).toBe(false);
    expect(isDelayed({ status: "confirmed", starts_at: start }, new Date("2026-10-15T08:15:00Z"))).toBe(true);
  });
  it("no alert once the truck has arrived", () => {
    expect(isDelayed({ status: "on_site", starts_at: start, arrived_at: "2026-10-15T08:20:00Z" }, new Date("2026-10-15T09:00:00Z"))).toBe(false);
  });
});

const row = (p: Partial<KpiRow>): KpiRow => ({ status: "departed", starts_at: start, arrived_at: null, unload_started_at: null, unload_ended_at: null, delay_alerted_at: null, penalty: false, total_pallets: 10, ...p });
describe("no-show indicator", () => {
  it("rate excludes cancelled bookings", () => {
    const k = computeKpis([row({ status: "no_show" }), row({}), row({}), row({}), row({ status: "cancelled" })]);
    expect(k.noShow).toBe(1);
    expect(k.noShowRate).toBe(25);
  });
});
