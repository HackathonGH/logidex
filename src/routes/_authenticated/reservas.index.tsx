import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { madridToISO, fmtDateTime, fmtTime } from "@/lib/reservations";
import { StaffPage } from "@/components/StaffPage";
import { StatusBadges } from "@/components/ReservationBadges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/reservas/")({
  head: () => ({ meta: [{ title: "Reservas — LOGIDEX" }, { name: "description", content: "Listado y edición de reservas de descarga" }] }),
  component: () => <StaffPage title="menu_reservations">{() => <ReservationList />}</StaffPage>,
});

const STATUSES = ["confirmed", "on_site", "unloading", "unloaded", "dock_released", "departed", "no_show", "cancelled"] as const;

function ReservationList() {
  const { t, lang } = useI18n();
  const [f, setF] = useState({ date: "", company: "all", status: "all", plate: "" });
  const companies = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => (await supabase.from("companies").select("id, name").order("name")).data ?? [],
  });
  const q = useQuery({
    queryKey: ["reservations", f],
    queryFn: async () => {
      let qb = supabase.from("reservations").select("*, companies(name)").order("starts_at").limit(200);
      if (f.date) {
        const next = new Date(f.date + "T00:00:00Z");
        next.setUTCDate(next.getUTCDate() + 1);
        qb = qb.gte("starts_at", madridToISO(f.date, "00:00")).lt("starts_at", madridToISO(next.toISOString().slice(0, 10), "00:00"));
      }
      if (f.company !== "all") qb = qb.eq("company_id", f.company);
      if (f.status !== "all") qb = qb.eq("status", f.status);
      const plate = f.plate.trim().replace(/[,%()]/g, "");
      if (plate) qb = qb.or(`tractor_plate.ilike.%${plate}%,trailer_plate.ilike.%${plate}%`);
      const { data, error } = await qb;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-5 sm:items-end">
        <div className="space-y-1"><Label>{t("date")}</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="space-y-1">
          <Label>{t("company")}</Label>
          <Select value={f.company} onValueChange={(v) => setF({ ...f, company: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {companies.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("status")}</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`rs_${s}` as TKey)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>{t("plate")}</Label><Input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} /></div>
        <Button variant="outline" onClick={() => setF({ date: "", company: "all", status: "all", plate: "" })}>{t("clear")}</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("company")}</TableHead>
              <TableHead>{t("pallets")}</TableHead>
              <TableHead>{t("driver")}</TableHead>
              <TableHead>{t("plate")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.map((r) => (
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell>
                  <Link to="/reservas/$id" params={{ id: r.id }} className="font-medium text-primary underline-offset-2 hover:underline">{r.code}</Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(r.starts_at, lang)} – {fmtTime(r.ends_at)}</TableCell>
                <TableCell className="text-sm">{r.companies?.name}</TableCell>
                <TableCell>{r.total_pallets}</TableCell>
                <TableCell className="text-sm">{r.driver_name}</TableCell>
                <TableCell className="text-sm">{r.tractor_plate}{r.trailer_plate ? ` / ${r.trailer_plate}` : ""}</TableCell>
                <TableCell><StatusBadges status={r.status} rescheduled={r.rescheduled} penalty={r.penalty} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!q.isLoading && !q.data?.length && <p className="p-6 text-center text-sm text-muted-foreground">{t("noReservations")}</p>}
        {q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">…</p>}
      </div>
    </div>
  );
}
