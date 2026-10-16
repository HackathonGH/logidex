import { describe, it, expect } from "vitest";
import { homeForRoles, menuForRoles, usernameToEmail, ASSIGNABLE_ROLES } from "./roles";

const keys = (r: Parameters<typeof menuForRoles>[0]) => menuForRoles(r).map((i) => i.key);

describe("role menus", () => {
  it("only admin sees administration", () => {
    expect(keys(["admin"])).toContain("menu_admin");
    expect(keys(["administrativo"])).not.toContain("menu_admin");
  });
  it("admin and administrativo can edit reservations and blocks", () => {
    expect(keys(["administrativo"])).toEqual(["menu_operations", "menu_reservations", "menu_indicators", "menu_reconcile", "menu_incidents", "menu_blocks", "menu_scan"]);
    expect(keys(["admin"])[0]).toBe("menu_admin");
    expect(keys(["transportista"])).not.toContain("menu_reservations");
  });
  it("Control de accesos only sees the QR scan", () => {
    expect(keys(["control_accesos"])).toEqual(["menu_scan"]);
    expect(keys(["transportista"])).not.toContain("menu_scan");
  });
});

describe("usernameToEmail", () => {
  it("normalizes case so ADMIN and admin are the same account", () => {
    expect(usernameToEmail("ADMIN")).toBe("admin@logidex.local");
    expect(usernameToEmail(" User1 ")).toBe("user1@logidex.local");
  });
});

describe("assignable roles", () => {
  it("admin, administrativo, transportista and control de accesos", () => {
    expect(ASSIGNABLE_ROLES).toEqual(["admin", "administrativo", "transportista", "control_accesos"]);
  });
});

describe("home after login", () => {
  it("admin lands on users, administrativo on operations, carrier on bookings", () => {
    expect(homeForRoles(["admin"])).toBe("/admin/usuarios");
    expect(homeForRoles(["administrativo"])).toBe("/operaciones");
    expect(homeForRoles(["transportista"])).toBe("/mis-reservas");
  });
});
