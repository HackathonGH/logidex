import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { computeKpis, madridToISO, toMadrid } from "@/lib/reservations";
import { StaffPage } from "@/components/StaffPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/indicadores")({
  head: () => ({ meta: [{ title: "Indicadores — LOGIDEX" }, { name: "description", content: "No presentados, retrasos y tiempos de descarga" }] }),
  component: () => <StaffPage title="menu_indicators">{() => <Kpis />}</StaffPage>,
});

function shift(d: string, n: number) { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }

function Kpis() {
  const { t } = useI18n();
  const today = toMadrid(new Date()).date;
  const [from, setFrom] = useState(() => shift(today, -30));
  const [to, setTo] = useState(today);
  const q = useQuery({
    queryKey: ["kpis", from, to],
    queryFn: async () => {
      const a = madridToISO(from, "00:00"), b = madridToISO(shift(to, 1), "00:00");
      const [{ data: rows }, { data: inc }, { data: ords }] = await Promise.all([
        supabase.from("reservations").select("status, starts_at, arrived_at, unload_started_at, unload_ended_at, delay_alerted_at, penalty, total_pallets, company_id, companies(name)").gte("starts_at", a).lt("starts_at", b),
        supabase.from("incidents").select("type, order_id, reservations!inner(starts_at)").gte("reservations.starts_at", a).lt("reservations.starts_at", b),
        supabase.from("reservation_orders").select("id, supplier, pallets, pallets_accepted, pallets_rejected, pallets_missing, reservations!inner(starts_at, status)").gte("reservations.starts_at", a).lt("reservations.starts_at", b),
      ]);
      return { rows: rows ?? [], inc: inc ?? [], ords: ords ?? [] };
    },
  });
  const rows = q.data?.rows ?? [];
  const k = computeKpis(rows);
  const min = (v: number | null) => (v == null ? "—" : `${v} ${t("minutes")}`);
  const cards: [TKey, string | number][] = [
    ["kpiTotal", k.total], ["kpiNoShow", k.noShow], ["kpiNoShowRate", `${k.noShowRate}%`], ["kpiDelayed", k.delayed],
    ["kpiAvgDelay", min(k.avgDelay)], ["kpiAvgWait", min(k.avgWait)], ["kpiAvgUnload", min(k.avgUnload)], ["kpiPallets", k.pallets],
    ["kpiCancelled", k.cancelled], ["kpiPenalty", k.penalty], ["kpiIncidents", q.data?.inc.length ?? 0],
  ];
  const byType = new Map<string, number>();
  q.data?.inc.forEach((i) => byType.set(i.type, (byType.get(i.type) ?? 0) + 1));
  const companies = new Map<string, { name: string; rows: typeof rows }>();
  rows.forEach((r) => { const c = companies.get(r.company_id) ?? { name: r.companies?.name ?? "—", rows: [] }; c.rows.push(r); companies.set(r.company_id, c); });

  const sup = new Map<string, { orders: number; planned: number; accepted: number; rejected: number; missing: number; noShow: number; incidents: number }>();
  q.data?.ords.forEach((o) => {
    const k = o.supplier.trim();
    const c = sup.get(k) ?? { orders: 0, planned: 0, accepted: 0, rejected: 0, missing: 0, noShow: 0, incidents: 0 };
    if (o.reservations.status !== "cancelled") { c.orders++; c.planned += o.pallets; }
    if (o.reservations.status === "no_show") c.noShow++;
    c.accepted += o.pallets_accepted ?? 0; c.rejected += o.pallets_rejected ?? 0; c.missing += o.pallets_missing ?? 0;
    c.incidents += q.data?.inc.filter((i) => i.order_id === o.id).length ?? 0;
    sup.set(k, c);
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label className="text-xs">{t("from")}</Label><Input type="date" className="w-44" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">{t("to")}</Label><Input type="date" className="w-44" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([key, v]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">{t(key)}</div>
            <div className="mt-1 font-display text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </div>
      {byType.size > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 font-display font-semibold">{t("kpiIncidents")}</h3>
          <div className="flex flex-wrap gap-2 text-sm">{[...byType].map(([ty, n]) => <span key={ty} className="rounded-md bg-muted px-2 py-1">{t(`inc_${ty}` as TKey)}: <strong>{n}</strong></span>)}</div>
        </section>
      )}
      <section className="overflow-x-auto rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 font-display font-semibold">{t("bySupplier")}</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">{t("supplierCol")}</th><th>{t("ordersCol")}</th><th>{t("planned")}</th><th>{t("accepted")}</th><th>{t("rejected")}</th><th>{t("missing")}</th><th>{t("kpiNoShow")}</th><th>{t("kpiIncidents")}</th></tr></thead>
          <tbody>
            {[...sup].sort((x, y) => y[1].planned - x[1].planned).map(([name, c]) => (
              <tr key={name} className="border-t border-border"><td className="py-1.5">{name}</td><td>{c.orders}</td><td>{c.planned}</td><td>{c.accepted}</td><td>{c.rejected}</td><td>{c.missing}</td><td>{c.noShow}</td><td>{c.incidents}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 font-display font-semibold">{t("byCompany")}</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">{t("company")}</th><th>{t("kpiTotal")}</th><th>{t("kpiNoShow")}</th><th>{t("kpiNoShowRate")}</th><th>{t("kpiDelayed")}</th><th>{t("kpiAvgDelay")}</th><th>{t("kpiPenalty")}</th></tr></thead>
          <tbody>
            {[...companies.values()].map((c) => { const x = computeKpis(c.rows); return (
              <tr key={c.name} className="border-t border-border"><td className="py-1.5">{c.name}</td><td>{x.total}</td><td>{x.noShow}</td><td>{x.noShowRate}%</td><td>{x.delayed}</td><td>{min(x.avgDelay)}</td><td>{x.penalty}</td></tr>
            ); })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
