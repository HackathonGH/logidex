import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { fmtDateTime, fmtTime, errorCode, isLateCancel } from "@/lib/reservations";
import { CarrierPage } from "@/components/CarrierPage";
import { StatusBadges } from "@/components/ReservationBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/mis-reservas/$id")({
  head: () => ({ meta: [{ title: "Detalle de reserva — LOGIDEX" }, { name: "description", content: "QR, conductor y estado de tu reserva" }] }),
  component: () => <CarrierPage title="menu_book" back="/mis-reservas"><BookingDetail /></CarrierPage>,
});

function BookingDetail() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-booking", id],
    queryFn: async () => {
      const [{ data: r, error }, { data: orders }] = await Promise.all([
        supabase.from("reservations").select("*").eq("id", id).single(),
        supabase.from("reservation_orders").select("order_number, supplier, pallets").eq("reservation_id", id).order("order_number"),
      ]);
      if (error) throw error;
      return { r, orders: orders ?? [] };
    },
  });
  const [d, setD] = useState({ name: "", doc: "", tractor: "", trailer: "" });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (q.data) setD({ name: q.data.r.driver_name, doc: q.data.r.driver_doc ?? "", tractor: q.data.r.tractor_plate, trailer: q.data.r.trailer_plate ?? "" });
  }, [q.data]);

  if (q.isLoading) return <p className="text-muted-foreground">…</p>;
  if (!q.data) return <p>{t("ERR_NOT_FOUND")}</p>;
  const { r, orders } = q.data;
  const editable = r.status === "confirmed";
  const late = isLateCancel(r.starts_at);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["my-booking", id] }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); };

  async function saveDriver() {
    const { error } = await supabase.rpc("carrier_update_driver", { _id: id, _driver_name: d.name, _driver_doc: d.doc, _tractor_plate: d.tractor, _trailer_plate: d.trailer });
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    toast.success(t("saved")); refresh();
  }
  async function cancel() {
    const { error } = await supabase.rpc("carrier_cancel_reservation", { _id: id, _reason: reason });
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    setOpen(false); toast.success(t("saved")); refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
          <div>
            <div className="font-display text-lg font-semibold">{r.code}</div>
            <div className="text-sm text-muted-foreground">{fmtDateTime(r.starts_at, lang)} – {fmtTime(r.ends_at)} · {r.total_pallets} {t("pallets").toLowerCase()}</div>
          </div>
          <StatusBadges status={r.status} rescheduled={r.rescheduled} penalty={r.penalty} />
        </div>

        <section className="space-y-2 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display font-semibold">{t("orders")}</h2>
          {orders.map((o) => (
            <div key={o.order_number} className="flex justify-between border-t border-border pt-2 text-sm first:border-0 first:pt-0">
              <span>{o.order_number} · {o.supplier}</span><strong>{o.pallets}</strong>
            </div>
          ))}
          {editable && <p className="pt-2 text-xs text-muted-foreground">{t("otherChanges")}</p>}
        </section>

        <fieldset disabled={!editable} className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <h2 className="font-display font-semibold sm:col-span-2">{t("stepDriver").replace(/^3\.\s*/, "")}</h2>
          <div className="space-y-1"><Label>{t("driver")}</Label><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("driverDoc")}</Label><Input value={d.doc} onChange={(e) => setD({ ...d, doc: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("tractorPlate")}</Label><Input value={d.tractor} onChange={(e) => setD({ ...d, tractor: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("trailerPlate")}</Label><Input value={d.trailer} onChange={(e) => setD({ ...d, trailer: e.target.value })} /></div>
          {editable && (
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Info className="h-4 w-4" />{t("driverQrNotice")}</p>
              <Button onClick={saveDriver}>{t("saveDriver")}</Button>
            </div>
          )}
        </fieldset>

        {editable ? (
          <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => { setReason(""); setOpen(true); }}>{t("cancelReservation")}</Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notEditable")}</p>
        )}
      </div>

      <aside className="flex flex-col items-center gap-3 self-start rounded-xl border border-border bg-card p-5 text-center">
        <h2 className="font-display font-semibold">{t("qrTitle")}</h2>
        {r.qr_valid && editable ? (
          <>
            <div className="rounded-lg bg-background p-3"><QRCodeSVG value={r.qr_token} size={200} /></div>
            <p className="text-xs text-muted-foreground">{t("qrHint")}</p>
          </>
        ) : (
          <p className="text-sm text-destructive">{t("qrInvalid")}</p>
        )}
      </aside>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{late ? t("lateCancelTitle") : `${t("cancelReservation")} ${r.code}`}</DialogTitle>
            {late && <DialogDescription>{t("lateCancelText")}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-1"><Label>{t("cancelReasonOpt")}</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("close")}</Button>
            <Button variant="destructive" onClick={cancel}>{t("confirmCancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
