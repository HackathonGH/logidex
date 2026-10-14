import { describe, it, expect } from "vitest";
import { durationForPallets, validateOrders, madridToISO, toMadrid, errorCode } from "./reservations";

describe("duration by pallets", () => {
  it("follows the PRD table", () => {
    expect(durationForPallets(15)).toBe(30);
    expect(durationForPallets(16)).toBe(45);
    expect(durationForPallets(20)).toBe(60);
    expect(durationForPallets(34)).toBe(120);
    expect(durationForPallets(67)).toBeNull();
  });
});

describe("order validation", () => {
  const o = (n: string, p = 5, s = "A") => ({ order_number: n, supplier: s, pallets: p });
  it("order numbers must be 10 digits starting with 4500", () => {
    expect(validateOrders([o("4500123456")])).toBeNull();
    expect(validateOrders([o("4501123456")])).toBe("ERR_ORDER_FORMAT");
  });
  it("max 6 orders, no duplicates, max 66 pallets", () => {
    expect(validateOrders(Array.from({ length: 7 }, (_, i) => o(`450000000${i}`)))).toBe("ERR_ORDERS_COUNT");
    expect(validateOrders([o("4500000001"), o("4500000001")])).toBe("ERR_ORDER_DUP");
    expect(validateOrders([o("4500000001", 40), o("4500000002", 27)])).toBe("ERR_PALLETS");
  });
});

describe("Madrid time", () => {
  it("converts summer and winter wall-clock times", () => {
    expect(madridToISO("2026-07-01", "08:00")).toBe("2026-07-01T06:00:00.000Z");
    expect(madridToISO("2026-12-01", "08:00")).toBe("2026-12-01T07:00:00.000Z");
    expect(toMadrid("2026-12-01T07:00:00Z")).toEqual({ date: "2026-12-01", time: "08:00" });
  });
  it("extracts rule codes from errors", () => {
    expect(errorCode("ERR_SHIFT_FULL")).toBe("ERR_SHIFT_FULL");
    expect(errorCode("forbidden")).toBe("ERR_FORBIDDEN");
  });
});

describe("24h carrier rule", () => {
  const now = new Date("2026-10-14T10:00:00Z");
  it("exactly 24 hours is allowed", () => expect(meetsAdvance("2026-10-15T10:00:00Z", now)).toBe(true));
  it("less than 24 hours is blocked", () => expect(meetsAdvance("2026-10-15T09:45:00Z", now)).toBe(false));
  it("cancel under 24h is subject to penalty", () => expect(isLateCancel("2026-10-15T09:00:00Z", now)).toBe(true));
  it("cancel with 24h or more has no penalty", () => expect(isLateCancel("2026-10-15T10:00:00Z", now)).toBe(false));
});
