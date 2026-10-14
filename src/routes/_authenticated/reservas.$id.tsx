import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Info, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { durationForPallets, validateOrders, TIME_SLOTS, toMadrid, fmtDateTime, fmtTime, errorCode, type OrderLine } from "@/lib/reservations";
import { StaffPage } from "@/components/StaffPage";
import { StatusBadges } from "@/components/ReservationBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/reservas/$id")({
  head: () => ({ meta: [{ title: "Editar reserva — LOGIDEX" }, { name: "description", content: "Ficha editable de una reserva de descarga" }] }),
  component: () => <StaffPage title="editReservation">{() => <ReservationEditor />}</StaffPage>,
});

type Form = { date: string; time: string; orders: OrderLine[]; driver_name: string; driver_doc: string; tractor_plate: string; trailer_plate: string };

function ReservationEditor() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["reservation", id],
    queryFn: async () => {
      const [{ data: r, error }, { data: orders }, { data: audit }] = await Promise.all([
        supabase.from("reservations").select("*, companies(name)").eq("id", id).single(),
        supabase.from("reservation_orders").select("order_number, supplier, pallets").eq("reservation_id", id).order("order_number"),
        supabase.from("reservation_audit").select("*").eq("reservation_id", id).order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      const actorIds = [...new Set((audit ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
      const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name, username").in("id", actorIds) : { data: [] };
      return { r, orders: orders ?? [], audit: (audit ?? []).map((a) => ({ ...a, actor: actors?.find((p) => p.id === a.actor_id) })) };
    },
  });
  const [f, setF] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!q.data) return;
    const { r, orders } = q.data;
    const m = toMadrid(r.starts_at);
    setF({ date: m.date, time: m.time, orders, driver_name: r.driver_name, driver_doc: r.driver_doc ?? "", tractor_plate: r.tractor_plate, trailer_plate: r.trailer_plate ?? "" });
  }, [q.data]);

  if (q.isLoading || !f) return <p className="text-muted-foreground">…</p>;
  if (q.error || !q.data) return <p>{t("ERR_NOT_FOUND")}</p>;
  const { r, audit } = q.data;
  const editable = r.status === "confirmed";
  const total = f.orders.reduce((s, o) => s + (Number(o.pallets) || 0), 0);
  const dur = durationForPallets(total);
  const setOrder = (i: number, patch: Partial<OrderLine>) => setF({ ...f, orders: f.orders.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  async function save() {
    if (!f) return;
    const local = validateOrders(f.orders);
    if (local) { toast.error(t(local as TKey)); return; }
    if (!f.driver_name.trim() || !f.tractor_plate.trim()) { toast.error(t("ERR_REQUIRED")); return; }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_reservation", {
      _id: id, _date: f.date, _time: f.time, _orders: f.orders,
      _driver_name: f.driver_name, _driver_doc: f.driver_doc, _tractor_plate: f.tractor_plate, _trailer_plate: f.trailer_plate,
    });
    setSaving(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["reservation", id] });
    qc.invalidateQueries({ queryKey: ["reservations"] });
  }
  async function cancel() {
    const { error } = await supabase.rpc("admin_cancel_reservation", { _id: id, _reason: reason });
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    setCancelOpen(false);
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["reservation", id] });
    qc.invalidateQueries({ queryKey: ["reservations"] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
          <div>
            <div className="font-display text-lg font-semibold">{r.code} · {r.companies?.name}</div>
            <div className="text-sm text-muted-foreground">{fmtDateTime(r.starts_at, lang)} – {fmtTime(r.ends_at)}</div>
          </div>
          <StatusBadges status={r.status} rescheduled={r.rescheduled} />
          {r.cancel_reason && <p className="w-full text-sm text-destructive">{t("reason")}: {r.cancel_reason}</p>}
        </div>

        <fieldset disabled={!editable} className="space-y-6">
          <section className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
            <div className="space-y-1"><Label>{t("date")}</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>{t("time")}</Label>
              <Select value={f.time} onValueChange={(v) => setF({ ...f, time: v })} disabled={!editable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("duration")}</Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm">{dur ? `${dur} ${t("minutes")}` : "—"}</div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold">{t("orders")}</h2>
              <span className="text-sm">{t("total")}: <strong>{total}</strong> {t("pallets").toLowerCase()}</span>
            </div>
            {f.orders.map((o, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_6rem_auto] sm:items-end">
                <div className="space-y-1"><Label className="text-xs">{t("orderNumber")}</Label><Input inputMode="numeric" maxLength={10} value={o.order_number} onChange={(e) => setOrder(i, { order_number: e.target.value.replace(/\D/g, "") })} /></div>
                <div className="space-y-1"><Label className="text-xs">{t("supplier")}</Label><Input value={o.supplier} onChange={(e) => setOrder(i, { supplier: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">{t("pallets")}</Label><Input type="number" min={1} max={66} value={o.pallets} onChange={(e) => setOrder(i, { pallets: Number(e.target.value) })} /></div>
                <Button type="button" variant="ghost" size="icon" aria-label={t("delete")} disabled={f.orders.length <= 1} onClick={() => setF({ ...f, orders: f.orders.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {f.orders.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setF({ ...f, orders: [...f.orders, { order_number: "4500", supplier: "", pallets: 1 }] })}>
                <Plus className="mr-1 h-4 w-4" />{t("addOrder")}
              </Button>
            )}
          </section>

          <section className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
            <div className="space-y-1"><Label>{t("driver")}</Label><Input value={f.driver_name} onChange={(e) => setF({ ...f, driver_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("driverDoc")}</Label><Input value={f.driver_doc} onChange={(e) => setF({ ...f, driver_doc: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("tractorPlate")}</Label><Input value={f.tractor_plate} onChange={(e) => setF({ ...f, tractor_plate: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("trailerPlate")}</Label><Input value={f.trailer_plate} onChange={(e) => setF({ ...f, trailer_plate: e.target.value })} /></div>
          </section>
        </fieldset>

        {editable ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Info className="h-4 w-4" />{t("qrNotice")}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => { setReason(""); setCancelOpen(true); }}>{t("cancelReservation")}</Button>
              <Button onClick={save} disabled={saving}>{t("save")}</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notEditable")}</p>
        )}
        <Link to="/reservas" className="text-sm text-muted-foreground hover:text-foreground">← {t("menu_reservations")}</Link>
      </div>

      <aside className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display font-semibold"><History className="h-4 w-4" />{t("history")}</h2>
        {!audit.length && <p className="text-sm text-muted-foreground">{t("noHistory")}</p>}
        {audit.map((a) => (
          <div key={a.id} className="border-t border-border pt-3 text-sm first:border-0 first:pt-0">
            <div className="font-medium">{t(`act_${a.action}` as TKey)}</div>
            <div className="text-xs text-muted-foreground">{fmtDateTime(a.created_at, lang)} · {a.actor?.full_name ?? a.actor?.username ?? "—"}</div>
            <AuditChanges changes={a.changes as Record<string, unknown>} />
          </div>
        ))}
      </aside>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("cancelReservation")} {r.code}</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label>{t("cancelReason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>{t("close")}</Button>
            <Button variant="destructive" disabled={!reason.trim()} onClick={cancel}>{t("confirmCancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FIELD_LABEL: Record<string, TKey> = {
  starts_at: "start", total_pallets: "pallets", orders: "orders", driver_name: "driver", driver_doc: "driverDoc",
  tractor_plate: "tractorPlate", trailer_plate: "trailerPlate", reason: "reason",
};

function AuditChanges({ changes }: { changes: Record<string, unknown> }) {
  const { t, lang } = useI18n();
  const show = (k: string, v: unknown) => {
    if (v == null || v === "") return "—";
    if (k === "starts_at") return fmtDateTime(String(v), lang);
    if (k === "orders") return (v as OrderLine[]).map((o) => `${o.order_number} (${o.pallets})`).join(", ");
    return String(v);
  };
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {Object.entries(changes).map(([k, v]) =>
        k === "qr_reissued" ? (
          <li key={k} className="text-warning-foreground">{t("qrReissued")}</li>
        ) : Array.isArray(v) && v.length === 2 && k !== "orders" ? (
          <li key={k}><span className="text-muted-foreground">{t(FIELD_LABEL[k] ?? "status")}:</span> {show(k, v[0])} → {show(k, v[1])}</li>
        ) : k === "orders" && Array.isArray(v) ? (
          <li key={k}><span className="text-muted-foreground">{t("orders")}:</span> {show(k, v[0])} → {show(k, v[1])}</li>
        ) : (
          <li key={k}><span className="text-muted-foreground">{t(FIELD_LABEL[k] ?? "status")}:</span> {show(k, v)}</li>
        ),
      )}
    </ul>
  );
}
