import type { TKey } from "./i18n";

/** Product roles defined in the PRD: administrador, administrativo, transportista. */
export type AppRole = "admin" | "administrativo" | "transportista";
export const ROLES: AppRole[] = ["admin", "administrativo", "transportista"];
/** Roles an admin can assign when creating an account from the Users screen. */
export const ASSIGNABLE_ROLES: AppRole[] = ["admin", "administrativo", "transportista"];

export type MenuItem = { key: TKey; to?: "/admin" };

/** Menu entries each role may see. */
export function menuForRoles(roles: AppRole[], canScan = false): MenuItem[] {
  const items: MenuItem[] = [];
  const has = (r: AppRole) => roles.includes(r);
  if (has("admin")) items.push({ key: "menu_admin", to: "/admin" });
  if (has("admin") || has("administrativo")) items.push({ key: "menu_reservations" }, { key: "menu_blocks" });
  if (has("transportista")) items.push({ key: "menu_book" });
  if (canScan && !has("transportista")) items.push({ key: "menu_scan" });
  return items;
}

/** Internal accounts log in with a username; auth needs an email, so derive one. */
export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${u}@logidex.local`;
}
