import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administración — LOGIDEX" }, { name: "description", content: "Administración de LOGIDEX" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useI18n();
  const me = useMe();
  if (me.isLoading) return <AppShell><p>…</p></AppShell>;
  const p = me.data?.profile;
  const name = p?.full_name ?? p?.username;
  if (!me.data?.roles.includes("admin")) return <AppShell name={name}><p>{t("noAccess")}</p></AppShell>;
  const tab = "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground";
  const active = { className: "bg-primary text-primary-foreground hover:text-primary-foreground" };
  return (
    <AppShell name={name}>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link to="/admin" activeOptions={{ exact: true }} className={tab} activeProps={active}>{t("requests")}</Link>
        <Link to="/admin/usuarios" className={tab} activeProps={active}>{t("users")}</Link>
        <Link to="/admin/ajustes" className={tab} activeProps={active}>{t("settings")}</Link>
      </div>
      <Outlet />
    </AppShell>
  );
}
