import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { useI18n, type TKey } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";

/** Page frame for admin + administrativo screens; hides content from other roles. */
export function StaffPage({ title, children }: { title: TKey; children: (ctx: { isAdmin: boolean }) => ReactNode }) {
  const { t } = useI18n();
  const me = useMe();
  if (me.isLoading) return <AppShell><p className="text-muted-foreground">…</p></AppShell>;
  const p = me.data?.profile;
  const name = p?.full_name ?? p?.username;
  const roles = me.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const ok = (isAdmin || roles.includes("administrativo")) && p?.status === "active" && !p?.must_change_password;
  return (
    <AppShell name={name}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/inicio" className="text-sm text-muted-foreground hover:text-foreground">← {t("back")}</Link>
        <h1 className="font-display text-2xl font-semibold">{t(title)}</h1>
      </div>
      {ok ? children({ isAdmin }) : <p>{t("noAccess")}</p>}
    </AppShell>
  );
}
