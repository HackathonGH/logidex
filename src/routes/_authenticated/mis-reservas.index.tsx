import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { fmtDateTime, fmtTime } from "@/lib/reservations";
import { CarrierPage } from "@/components/CarrierPage";
import { StatusBadges } from "@/components/ReservationBadges";
import { Button } from "@/components/ui/button";
import { ContactCard } from "@/components/AppShell";
import { useSettings } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/mis-reservas/")({
  head: () => ({ meta: [{ title: "Mis reservas — LOGIDEX" }, { name: "description", content: "Reservas de descarga de tu empresa" }] }),
  component: () => <CarrierPage title="menu_book"><MyBookings /></CarrierPage>,
});

function MyBookings() {
  const { t, lang } = useI18n();
  const settings = useSettings();
  const q = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => (await supabase.from("reservations").select("id, code, starts_at, ends_at, total_pallets, status, rescheduled, penalty, driver_name").order("starts_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("rule24h")}</p>
        <Button asChild><Link to="/mis-reservas/nueva"><Plus className="mr-1 h-4 w-4" />{t("newBooking")}</Link></Button>
      </div>
      {q.isLoading && <p className="text-muted-foreground">…</p>}
      {q.data && !q.data.length && <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">{t("noBookings")}</p>}
      <div className="grid gap-3">
        {q.data?.map((r) => (
          <Link key={r.id} to="/mis-reservas/$id" params={{ id: r.id }} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-secondary">
            <div>
              <div className="font-display font-semibold">{r.code}</div>
              <div className="text-sm text-muted-foreground">{fmtDateTime(r.starts_at, lang)} – {fmtTime(r.ends_at)} · {r.total_pallets} {t("pallets").toLowerCase()} · {r.driver_name}</div>
            </div>
            <StatusBadges status={r.status} rescheduled={r.rescheduled} penalty={r.penalty} />
          </Link>
        ))}
      </div>
      <ContactCard phone={settings.data?.contact_phone} email={settings.data?.contact_email} />
    </div>
  );
}
