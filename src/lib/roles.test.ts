import { describe, it, expect } from "vitest";
import { menuForRoles, usernameToEmail, ASSIGNABLE_ROLES } from "./roles";

const keys = (r: Parameters<typeof menuForRoles>[0], s = false) => menuForRoles(r, s).map((i) => i.key);

describe("role menus", () => {
  it("only admin sees administration", () => {
    expect(keys(["admin"])).toContain("menu_admin");
    expect(keys(["administrativo"])).not.toContain("menu_admin");
  });
  it("admin and administrativo can edit reservations and blocks", () => {
    expect(keys(["administrativo"])).toEqual(["menu_reservations", "menu_blocks"]);
    expect(keys(["transportista"])).not.toContain("menu_reservations");
  });
  it("QR scan only when permission granted to internal staff", () => {
    expect(keys(["administrativo"])).not.toContain("menu_scan");
    expect(keys(["administrativo"], true)).toContain("menu_scan");
  });
});

describe("usernameToEmail", () => {
  it("normalizes case so ADMIN and admin are the same account", () => {
    expect(usernameToEmail("ADMIN")).toBe("admin@logidex.local");
    expect(usernameToEmail(" User1 ")).toBe("user1@logidex.local");
  });
});

describe("assignable roles", () => {
  it("match the PRD: admin, administrativo, transportista", () => {
    expect(ASSIGNABLE_ROLES).toEqual(["admin", "administrativo", "transportista"]);
  });
});
