import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { toMadrid, madridToISO, fmtTime, errorCode, minutesBetween, nextAction } from "@/lib/reservations";
import { StaffPage } from "@/components/StaffPage";
import { StatusBadges } from "@/components/ReservationBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/operaciones")({
  head: () => ({ meta: [{ title: "Agenda operativa — LOGIDEX" }, { name: "description", content: "Llegadas, muelles y ciclo de descarga del día" }] }),
  component: () => <StaffPage title="menu_operations">{() => <Board />}</StaffPage>,
});

function addDays(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10);
}

function Board() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => toMadrid(new Date()).date);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["ops", date],
    queryFn: async () => (await supabase.from("reservations").select("*, companies(name)")
      .gte("starts_at", madridToISO(date, "00:00")).lt("starts_at", madridToISO(addDays(date, 1), "00:00")).order("starts_at")).data ?? [],
  });
  useEffect(() => {
    const ch = supabase.channel("ops-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => qc.invalidateQueries({ queryKey: ["ops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  const sel = q.data?.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" aria-label={t("prev")} onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Button size="icon" variant="outline" aria-label={t("next")} onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" onClick={() => setDate(toMadrid(new Date()).date)}>{t("today")}</Button>
      </div>
      {q.data && !q.data.length && <p className="text-muted-foreground">{t("noReservations")}</p>}
      <div className="grid gap-2">
        {q.data?.map((r) => {
          const delay = r.arrived_at ? minutesBetween(r.starts_at, r.arrived_at) : null;
          return (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-secondary sm:grid-cols-[5rem_1fr_auto] sm:items-center">
              <div className="font-display text-lg font-semibold">{fmtTime(r.starts_at)}</div>
              <div>
                <div className="font-medium">{r.code} · {r.companies?.name}</div>
                <div className="text-sm text-muted-foreground">{r.total_pallets} {t("pallets").toLowerCase()} · {r.driver_name} · {r.tractor_plate}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {r.dock_id ? <Badge>{t("dock")} {r.dock_id}</Badge> : r.status === "on_site" ? <Badge variant="outline" className="border-warning/50 bg-warning/20">{t("waitingDock")}</Badge> : null}
                {delay != null && delay > 0 && <Badge variant="outline">{t("delayMin")} {delay} {t("minutes")}</Badge>}
                <StatusBadges status={r.status} rescheduled={r.rescheduled} penalty={r.penalty} />
              </div>
            </button>
          );
        })}
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="overflow-y-auto">{sel && <Detail r={sel} />}</SheetContent>
      </Sheet>
    </div>
  );
}

type Row = NonNullable<ReturnType<typeof useBoardRow>>;
function useBoardRow() { return null as unknown as { id: string; code: string; status: string; starts_at: string; ends_at: string; dock_id: number | null; arrived_at: string | null; unload_started_at: string | null; unload_ended_at: string | null; dock_released_at: string | null; departed_at: string | null; driver_name: string; driver_doc: string | null; tractor_plate: string; trailer_plate: string | null; total_pallets: number; rescheduled: boolean; penalty: boolean; companies: { name: string } | null }; }

function Detail({ r }: { r: Row }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const canDock = r.status === "on_site" || r.status === "unloading";
  const docks = useQuery({
    queryKey: ["free-docks", r.id, r.status, r.dock_id],
    enabled: canDock,
    queryFn: async () => { const { data, error } = await supabase.rpc("free_docks", { _id: r.id }); if (error) throw error; return (data ?? []) as number[]; },
  });
  const orders = useQuery({
    queryKey: ["ops-orders", r.id],
    queryFn: async () => (await supabase.from("reservation_orders").select("order_number, supplier, pallets").eq("reservation_id", r.id).order("order_number")).data ?? [],
  });
  const done = () => { qc.invalidateQueries({ queryKey: ["ops"] }); qc.invalidateQueries({ queryKey: ["free-docks"] }); };
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    toast.success(t("saved")); done();
  }
  const next = nextAction(r.status);
  const fmt = (v: string | null) => (v ? fmtTime(v) : "—");
  const mins = (a: string | null, b: string | null) => { const m = minutesBetween(a, b); return m == null ? "—" : `${m} ${t("minutes")}`; };

  return (
    <div className="space-y-5">
      <SheetHeader><SheetTitle>{r.code} · {r.companies?.name}</SheetTitle></SheetHeader>
      <StatusBadges status={r.status} rescheduled={r.rescheduled} penalty={r.penalty} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("driver")}</dt><dd>{r.driver_name} · {r.driver_doc ?? "—"}</dd>
        <dt className="text-muted-foreground">{t("plate")}</dt><dd>{r.tractor_plate}{r.trailer_plate ? ` / ${r.trailer_plate}` : ""}</dd>
        <dt className="text-muted-foreground">{t("pallets")}</dt><dd>{r.total_pallets}</dd>
      </dl>

      <section className="space-y-1 text-sm">
        <h3 className="font-display font-semibold">{t("orders")}</h3>
        {orders.data?.map((o) => <div key={o.order_number} className="flex justify-between"><span>{o.order_number} · {o.supplier}</span><strong>{o.pallets}</strong></div>)}
      </section>

      <section className="grid grid-cols-2 gap-2 text-sm">
        {([["scheduled", r.starts_at], ["arrived", r.arrived_at], ["unloadStart", r.unload_started_at], ["unloadEnd", r.unload_ended_at], ["released", r.dock_released_at], ["departed", r.departed_at]] as const).map(([k, v]) => (
          <div key={k} className="rounded-md border border-border p-2"><div className="text-xs text-muted-foreground">{t(k)}</div><div className="font-medium">{fmt(v)}</div></div>
        ))}
        <div className="col-span-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>{t("delayMin")}: {mins(r.starts_at, r.arrived_at)}</span>
          <span>{t("waitMin")}: {mins(r.arrived_at, r.unload_started_at)}</span>
          <span>{t("unloadMin")}: {mins(r.unload_started_at, r.unload_ended_at)}</span>
          <span>{t("stayMin")}: {mins(r.arrived_at, r.departed_at)}</span>
        </div>
      </section>

      {canDock && (
        <section className="space-y-2">
          <h3 className="font-display font-semibold">{t("assignDock")}{r.dock_id ? ` · ${t("dock")} ${r.dock_id}` : ""}</h3>
          {docks.data && !docks.data.length && <p className="text-sm text-muted-foreground">{t("noFreeDock")}</p>}
          <div className="flex flex-wrap gap-2">
            {docks.data?.map((d, i) => (
              <Button key={d} size="sm" variant={r.dock_id === d ? "default" : "outline"} disabled={busy || r.dock_id === d}
                onClick={() => run(() => supabase.rpc("staff_assign_dock", { _id: r.id, _dock: d }))}>
                {t("dock")} {d}{!r.dock_id && i === 0 ? ` (${t("suggested")})` : ""}
              </Button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {next && <Button size="lg" disabled={busy} onClick={() => run(() => supabase.rpc("staff_advance", { _id: r.id, _action: next }))}>{t(`act_${next}` as TKey)}</Button>}
        {r.status === "confirmed" && (
          <Button variant="outline" className="border-destructive/40 text-destructive" disabled={busy}
            onClick={() => { if (window.confirm(t("noShowConfirm"))) run(() => supabase.rpc("staff_advance", { _id: r.id, _action: "no_show" })); }}>{t("act_no_show")}</Button>
        )}
        <Link to="/reservas/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" />{t("editReservation")}</Link>
      </div>
    </div>
  );
}
