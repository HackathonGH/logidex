import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-me";
import { useI18n, type TKey } from "@/lib/i18n";
import { durationForPallets, validateOrders, toMadrid, errorCode, type OrderLine } from "@/lib/reservations";
import { CarrierPage } from "@/components/CarrierPage";
import { ContactCard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/mis-reservas/nueva")({
  head: () => ({ meta: [{ title: "Nueva reserva — LOGIDEX" }, { name: "description", content: "Reserva una franja de descarga" }] }),
  component: () => <CarrierPage title="newBooking" back="/mis-reservas"><NewBooking /></CarrierPage>,
});

function NewBooking() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const settings = useSettings();
  const [orders, setOrders] = useState<OrderLine[]>([{ order_number: "4500", supplier: "", pallets: 1 }]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [drv, setDrv] = useState({ name: "", doc: "", tractor: "", trailer: "" });
  const [busy, setBusy] = useState(false);
  const total = orders.reduce((s, o) => s + (Number(o.pallets) || 0), 0);
  const dur = durationForPallets(total);
  const ordersErr = validateOrders(orders);
  const minDate = toMadrid(new Date(Date.now() + 24 * 3600 * 1000)).date;

  const slots = useQuery({
    queryKey: ["slots", date, total],
    enabled: !!date && !!dur && !ordersErr,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("carrier_available_slots", { _date: date, _pallets: total });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
  const setOrder = (i: number, patch: Partial<OrderLine>) => { setOrders(orders.map((o, j) => (j === i ? { ...o, ...patch } : o))); setTime(""); };

  async function submit() {
    if (ordersErr) { toast.error(t(ordersErr as TKey)); return; }
    if (!drv.name.trim() || !drv.doc.trim() || !drv.tractor.trim() || !time) { toast.error(t("ERR_REQUIRED")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("carrier_create_reservation", {
      _date: date, _time: time, _orders: orders, _driver_name: drv.name, _driver_doc: drv.doc, _tractor_plate: drv.tractor, _trailer_plate: drv.trailer,
    });
    setBusy(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); qc.invalidateQueries({ queryKey: ["slots"] }); return; }
    toast.success(t("bookingDone"));
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
    nav({ to: "/mis-reservas/$id", params: { id: data as string } });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" />{t("rule24h")}</p>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">{t("stepOrders")}</h2>
          <span className="text-sm">{t("total")}: <strong>{total}</strong> · {t("duration")}: <strong>{dur ? `${dur} ${t("minutes")}` : "—"}</strong></span>
        </div>
        {orders.map((o, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_6rem_auto] sm:items-end">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs">{t("orderNumber")}</Label>
                <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild>
                  <button type="button" aria-label={t("orderHint")} className="text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" /></button>
                </TooltipTrigger><TooltipContent className="max-w-xs">{t("orderHint")}</TooltipContent></Tooltip></TooltipProvider>
              </div>
              <div className="flex h-9 items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <span className="pl-3 font-mono text-sm">4500</span>
                <input inputMode="numeric" maxLength={6} placeholder="XXXXXX" className="h-full w-full min-w-0 bg-transparent pr-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
                  value={o.order_number.slice(4)} onChange={(e) => setOrder(i, { order_number: "4500" + e.target.value.replace(/\D/g, "").slice(0, 6) })} />
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">{t("supplier")}</Label><Input value={o.supplier} onChange={(e) => setOrder(i, { supplier: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">{t("pallets")}</Label><Input type="number" min={1} max={66} value={o.pallets} onChange={(e) => setOrder(i, { pallets: Number(e.target.value) })} /></div>
            <Button type="button" variant="ghost" size="icon" aria-label={t("delete")} disabled={orders.length <= 1} onClick={() => setOrders(orders.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {orders.length < 6 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOrders([...orders, { order_number: "4500", supplier: "", pallets: 1 }])}><Plus className="mr-1 h-4 w-4" />{t("addOrder")}</Button>
        )}
        {ordersErr && orders.some((o) => o.supplier) && <p className="text-sm text-destructive">{t(ordersErr as TKey)}</p>}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display font-semibold">{t("stepSlot")}</h2>
        <div className="max-w-xs space-y-1"><Label>{t("date")}</Label><Input type="date" min={minDate} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} /></div>
        {!date ? <p className="text-sm text-muted-foreground">{t("pickDate")}</p> : ordersErr ? null : slots.isLoading ? <p className="text-muted-foreground">…</p> : (
          slots.data?.length ? (
            <div>
              <Label className="text-xs">{t("availableSlots")}</Label>
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {slots.data.map((s) => (
                  <Button key={s} type="button" size="sm" variant={time === s ? "default" : "outline"} onClick={() => setTime(s)}>{s}</Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3"><p className="text-sm text-muted-foreground">{slots.error ? t(errorCode((slots.error as Error).message) as TKey) : t("noSlots")}</p>
              <ContactCard phone={settings.data?.contact_phone} email={settings.data?.contact_email} /></div>
          )
        )}
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <h2 className="font-display font-semibold sm:col-span-2">{t("stepDriver")}</h2>
        <div className="space-y-1"><Label>{t("driver")}</Label><Input value={drv.name} onChange={(e) => setDrv({ ...drv, name: e.target.value })} /></div>
        <div className="space-y-1"><Label>{t("driverDoc")}</Label><Input value={drv.doc} onChange={(e) => setDrv({ ...drv, doc: e.target.value })} /></div>
        <div className="space-y-1"><Label>{t("tractorPlate")}</Label><Input value={drv.tractor} onChange={(e) => setDrv({ ...drv, tractor: e.target.value })} /></div>
        <div className="space-y-1"><Label>{t("trailerPlate")}</Label><Input value={drv.trailer} onChange={(e) => setDrv({ ...drv, trailer: e.target.value })} /></div>
      </section>

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={busy || !time || !!ordersErr || !drv.name.trim() || !drv.doc.trim() || !drv.tractor.trim()}>{t("confirmBooking")}</Button>
      </div>
    </div>
  );
}
