import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail, ASSIGNABLE_ROLES, type AppRole } from "./roles";

type NewUser = { username: string; password: string; fullName: string; role: AppRole };

export const createInternalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: NewUser) => {
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(d.username)) throw new Error("Usuario no válido (3-30 caracteres, sin espacios)");
    if (!d.password || d.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
    if (!ASSIGNABLE_ROLES.includes(d.role)) throw new Error("Rol no válido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return createAccount(supabaseAdmin, data, true);
  });

async function createAccount(admin: any, d: NewUser, mustChange: boolean) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(d.username),
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.fullName },
  });
  if (error) throw new Error(error.message.includes("already") ? "Ese usuario ya existe" : error.message);
  const id = created.user.id;
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id, email: usernameToEmail(d.username), username: d.username, full_name: d.fullName, is_internal: true, must_change_password: mustChange, status: "active" });
  if (pErr) throw new Error(pErr.message);
  const { error: rErr } = await admin.from("user_roles").insert({ user_id: id, role: d.role });
  if (rErr) throw new Error(rErr.message);
  return { id };
}

/** One-time preview bootstrap: creates demo ADMIN / user1 only while no admin exists. */
export const bootstrapDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) > 0) return { created: false };
  await createAccount(supabaseAdmin, { username: "ADMIN", password: "Logidex2026!", fullName: "Administrador demo", role: "admin" }, false);
  await createAccount(supabaseAdmin, { username: "user1", password: "Logidex2026!", fullName: "Administrativo demo", role: "administrativo" }, false);
  return { created: true };
});
