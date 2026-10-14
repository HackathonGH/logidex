import { describe, it, expect } from "vitest";
import { checkGoods, incidentFileOk } from "./reservations";

const g = (p: number | null, a: number | null, r: number | null, m: number | null, reason = "") => ({ presented: p, accepted: a, rejected: r, missing: m, reason });

describe("goods reconciliation", () => {
  it("rejected plus accepted cannot exceed presented", () => expect(checkGoods(g(10, 8, 3, 0, "rotos"), false)).toBe("ERR_GOODS_OVER_PRESENTED"));
  it("rejections need a reason", () => expect(checkGoods(g(10, 8, 2, 0), false)).toBe("ERR_REJECT_REASON"));
  it("pending count may leave quantities empty (missing not inferred)", () => expect(checkGoods(g(null, null, null, null), false)).toBeNull());
  it("reconciling needs every quantity", () => expect(checkGoods(g(10, 10, 0, null), true)).toBe("ERR_GOODS_INCOMPLETE"));
  it("reconciling needs accepted + rejected = presented", () => expect(checkGoods(g(10, 7, 2, 0, "x"), true)).toBe("ERR_GOODS_SUM"));
  it("presented below planned is allowed", () => expect(checkGoods(g(8, 8, 0, 2), true)).toBeNull());
});

describe("incident attachments", () => {
  it("accepts images and PDF up to 10 MB", () => {
    expect(incidentFileOk({ type: "image/jpeg", size: 1000 })).toBe(true);
    expect(incidentFileOk({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 })).toBe(false);
    expect(incidentFileOk({ type: "application/zip", size: 10 })).toBe(false);
  });
});
