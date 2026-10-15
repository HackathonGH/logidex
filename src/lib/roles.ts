import type { TKey } from "./i18n";

/** Product roles defined in the PRD: administrador, administrativo, transportista. */
export type AppRole = "admin" | "administrativo" | "transportista" | "control_accesos";
export const ROLES: AppRole[] = ["admin", "administrativo", "transportista", "control_accesos"];
/** Roles an admin can assign when creating an account from the Users screen. */
export const ASSIGNABLE_ROLES: AppRole[] = ["admin", "administrativo", "transportista", "control_accesos"];

export type MenuItem = { key: TKey; to?: "/admin" | "/reservas" | "/bloqueos" | "/mis-reservas" | "/acceso" | "/operaciones" | "/incidencias" | "/conciliacion" };

/** Menu entries each role may see. */
export function menuForRoles(roles: AppRole[]): MenuItem[] {
  const items: MenuItem[] = [];
  const has = (r: AppRole) => roles.includes(r);
  if (has("admin")) items.push({ key: "menu_admin", to: "/admin" });
  const manager = has("admin") || has("administrativo");
  if (manager) items.push({ key: "menu_operations", to: "/operaciones" }, { key: "menu_reconcile", to: "/conciliacion" }, { key: "menu_incidents", to: "/incidencias" }, { key: "menu_reservations", to: "/reservas" }, { key: "menu_blocks", to: "/bloqueos" });
  if (has("transportista")) items.push({ key: "menu_book", to: "/mis-reservas" });
  if (manager || has("control_accesos")) items.push({ key: "menu_scan", to: "/acceso" });
  return items;
}

/** Internal accounts log in with a username; auth needs an email, so derive one. */
export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${u}@logidex.local`;
}
