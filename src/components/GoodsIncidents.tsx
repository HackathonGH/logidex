import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type TKey } from "@/lib/i18n";
import { checkGoods, errorCode, fmtTime, incidentFileOk } from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Order = Tables<"reservation_orders">;
const ARRIVED = ["on_site", "unloading", "unloaded", "dock_released", "departed"];
const TYPES = ["delay", "damaged", "wet", "return", "difference", "other"] as const;
const SEVS = ["low", "medium", "high"] as const;
const num = (v: string) => (v === "" ? null : Number(v));

export function useOrders(reservationId: string) {
  return useQuery({
    queryKey: ["ops-orders", reservationId],
    queryFn: async () => (await supabase.from("reservation_orders").select("*").eq("reservation_id", reservationId).order("order_number")).data ?? [],
  });
}

export function GoodsPanel({ reservationId, status }: { reservationId: string; status: string }) {
  const { t } = useI18n();
  const orders = useOrders(reservationId);
  const list = orders.data ?? [];
  const sum = (k: keyof Order) => list.reduce((s, o) => s + (Number(o[k]) || 0), 0);
  const pending = list.filter((o) => o.reconciliation_status !== "done").length;
  const arrived = ARRIVED.includes(status);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">{t("goods")}</h3>
        {arrived && list.length > 0 && (
          pending ? <Badge variant="outline" className="border-warning/50 bg-warning/20">{t("recPending")} ({pending})</Badge>
            : <Badge className="bg-success text-success-foreground">{t("recDone")}</Badge>
        )}
      </div>
      {list.map((o) => <OrderRow key={o.id} o={o} editable={arrived} />)}
      {arrived && list.length > 0 && (
        <div className="grid grid-cols-5 gap-1 rounded-md bg-muted p-2 text-center text-[11px]">
          {(["planned", "presented", "accepted", "rejected", "missing"] as const).map((k) => <div key={k} className="truncate text-muted-foreground" title={t(k)}>{t(k)}</div>)}
          <strong>{sum("pallets")}</strong><strong>{sum("pallets_presented")}</strong><strong>{sum("pallets_accepted")}</strong><strong>{sum("pallets_rejected")}</strong><strong>{sum("pallets_missing")}</strong>
        </div>
      )}
    </section>
  );
}

function OrderRow({ o, editable }: { o: Order; editable: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const s = (v: number | null) => (v == null ? "" : String(v));
  const [g, setG] = useState({ presented: s(o.pallets_presented), accepted: s(o.pallets_accepted), rejected: s(o.pallets_rejected), missing: s(o.pallets_missing), reason: o.reject_reason ?? "", dest: o.reject_destination ?? "" });
  const [busy, setBusy] = useState(false);

  async function save(complete: boolean) {
    const vals = { presented: num(g.presented), accepted: num(g.accepted), rejected: num(g.rejected), missing: num(g.missing), reason: g.reason };
    const err = checkGoods(vals, complete);
    if (err) { toast.error(t(err as TKey)); return; }
    setBusy(true);
    const { error } = await supabase.rpc("staff_reconcile_order", {
      _order: o.id, _presented: vals.presented as number, _accepted: vals.accepted as number, _rejected: vals.rejected as number,
      _missing: vals.missing as number, _reason: g.reason, _destination: g.dest, _complete: complete,
    });
    setBusy(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    toast.success(t("saved")); setOpen(false);
    qc.invalidateQueries({ queryKey: ["ops-orders", o.reservation_id] });
  }

  return (
    <div className="rounded-md border border-border p-2 text-sm">
      <button type="button" disabled={!editable} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 text-left">
        <span>{o.order_number} · {o.supplier}</span>
        <span className="flex items-center gap-2">
          <strong>{o.pallets}</strong>
          {editable && <Badge variant="outline" className={o.reconciliation_status === "done" ? "border-success/50" : "border-warning/50"}>{t(o.reconciliation_status === "done" ? "recDone" : "recPending")}</Badge>}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {(["presented", "accepted", "rejected", "missing"] as const).map((k) => (
              <div key={k} className="space-y-1"><Label className="text-xs">{t(k)}</Label>
                <Input type="number" min={0} value={g[k]} onChange={(e) => setG({ ...g, [k]: e.target.value })} /></div>
            ))}
          </div>
          {Number(g.rejected) > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1"><Label className="text-xs">{t("rejectReason")}</Label><Input value={g.reason} onChange={(e) => setG({ ...g, reason: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("rejectDestination")}</Label><Input value={g.dest} onChange={(e) => setG({ ...g, dest: e.target.value })} /></div>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save(false)}>{t("savePending")}</Button>
            <Button size="sm" disabled={busy} onClick={() => save(true)}>{t("saveDone")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IncidentsPanel({ reservationId }: { reservationId: string }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const orders = useOrders(reservationId);
  const q = useQuery({
    queryKey: ["incidents", reservationId],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("*").eq("reservation_id", reservationId).order("created_at", { ascending: false });
      const list = data ?? [];
      const ids = [...new Set(list.map((i) => i.created_by).filter(Boolean))] as string[];
      const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, username").in("id", ids) : { data: [] };
      const files = await Promise.all(list.map(async (i) => (await supabase.storage.from("incident-files").list(i.id)).data ?? []));
      return list.map((i, k) => ({ ...i, author: people?.find((p) => p.id === i.created_by), files: (files[k] ?? []).map((f) => f.name) }));
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "damaged", severity: "medium", order: "none", description: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["incidents", reservationId] });

  async function create() {
    if (!form.description.trim()) { toast.error(t("ERR_REQUIRED")); return; }
    if (files.some((f) => !incidentFileOk(f))) { toast.error(t("ERR_FILE_TYPE")); return; }
    setBusy(true);
    const { data: id, error } = await supabase.rpc("staff_create_incident", {
      _reservation: reservationId, _order: (form.order === "none" ? null : form.order) as string, _type: form.type, _severity: form.severity, _description: form.description,
    });
    if (!error && id) {
      for (const f of files) {
        const name = `${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
        await supabase.storage.from("incident-files").upload(`${id}/${name}`, f, { contentType: f.type });
      }
    }
    setBusy(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    toast.success(t("saved")); setOpen(false); setFiles([]); setForm({ ...form, description: "" }); refresh();
  }
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.rpc("staff_set_incident_status", { _id: id, _status: status });
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    refresh();
  }
  async function openFile(id: string, name: string) {
    const { data } = await supabase.storage.from("incident-files").createSignedUrl(`${id}/${name}`, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  const orderLabel = (oid: string | null) => orders.data?.find((o) => o.id === oid)?.order_number;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">{t("incidents")}</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}><Plus className="mr-1 h-4 w-4" />{t("newIncident")}</Button>
      </div>
      {open && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">{t("incType")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((k) => <SelectItem key={k} value={k}>{t(`inc_${k}`)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">{t("severity")}</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVS.map((k) => <SelectItem key={k} value={k}>{t(`sev_${k}`)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t("relatedOrder")}</Label>
            <Select value={form.order} onValueChange={(v) => setForm({ ...form, order: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">{t("noOrder")}</SelectItem>{orders.data?.map((o) => <SelectItem key={o.id} value={o.id}>{o.order_number} · {o.supplier}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">{t("attachments")}</Label>
            <Input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></div>
          <div className="flex justify-end"><Button size="sm" disabled={busy} onClick={create}>{t("save")}</Button></div>
        </div>
      )}
      {q.data && !q.data.length && <p className="text-sm text-muted-foreground">{t("noIncidents")}</p>}
      {q.data?.map((i) => (
        <div key={i.id} className="space-y-1 rounded-md border border-border p-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{t(`inc_${i.type}` as TKey)}</strong>
            <Badge variant="outline" className={i.severity === "high" ? "border-destructive/50 text-destructive" : i.severity === "medium" ? "border-warning/50" : ""}>{t(`sev_${i.severity}` as TKey)}</Badge>
            <Badge variant={i.status === "open" ? "default" : "secondary"}>{t(`inc_${i.status}` as TKey)}</Badge>
            {orderLabel(i.order_id) && <span className="text-xs text-muted-foreground">#{orderLabel(i.order_id)}</span>}
          </div>
          <p>{i.description}</p>
          {i.files.map((n) => (
            <button key={n} type="button" onClick={() => openFile(i.id, n)} className="flex items-center gap-1 text-xs text-secondary hover:underline"><Paperclip className="h-3 w-3" />{n.replace(/^\d+-/, "")}</button>
          ))}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{new Date(i.created_at).toLocaleDateString(lang, { timeZone: "Europe/Madrid" })} {fmtTime(i.created_at)} · {i.author?.full_name ?? i.author?.username ?? "—"}</span>
            <Button size="sm" variant="ghost" onClick={() => setStatus(i.id, i.status === "open" ? "resolved" : "open")}>{t(i.status === "open" ? "resolve" : "reopen")}</Button>
          </div>
        </div>
      ))}
    </section>
  );
}
