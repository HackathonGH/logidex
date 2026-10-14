import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { useI18n, type TKey } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";

/** Page frame for carrier screens; only active carriers linked to a company see content. */
export function CarrierPage({ title, back = "/inicio", children }: { title: TKey; back?: "/inicio" | "/mis-reservas"; children: ReactNode }) {
  const { t } = useI18n();
  const me = useMe();
  if (me.isLoading) return <AppShell><p className="text-muted-foreground">…</p></AppShell>;
  const p = me.data?.profile;
  const ok = (me.data?.roles ?? []).includes("transportista") && p?.status === "active" && !!p?.company_id;
  return (
    <AppShell name={p?.full_name ?? p?.email ?? undefined}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to={back} className="text-sm text-muted-foreground hover:text-foreground">← {t("back")}</Link>
        <h1 className="font-display text-2xl font-semibold">{t(title)}</h1>
      </div>
      {ok ? children : <p>{t("noAccess")}</p>}
    </AppShell>
  );
}
