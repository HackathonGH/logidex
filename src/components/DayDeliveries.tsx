import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { toMadrid, madridToISO, fmtTime } from "@/lib/reservations";
import { StatusBadges } from "@/components/ReservationBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DayRow = Tables<"reservations"> & { companies: { name: string } | null };

function addDays(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10);
}

/** Day picker + delivery list on the left, a panel for the selected delivery on the right. */
export function DayDeliveries({ filter, children }: { filter?: (r: DayRow) => boolean; children: (r: DayRow) => ReactNode }) {
  const { t } = useI18n();
  const [date, setDate] = useState(() => toMadrid(new Date()).date);
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["day-deliveries", date],
    queryFn: async () => ((await supabase.from("reservations").select("*, companies(name)")
      .gte("starts_at", madridToISO(date, "00:00")).lt("starts_at", madridToISO(addDays(date, 1), "00:00")).order("starts_at")).data ?? []) as DayRow[],
  });
  const list = (q.data ?? []).filter((r) => (filter ? filter(r) : true));
  const cur = list.find((r) => r.id === sel) ?? null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" aria-label={t("prev")} onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Button size="icon" variant="outline" aria-label={t("next")} onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" onClick={() => setDate(toMadrid(new Date()).date)}>{t("today")}</Button>
      </div>
      {q.data && !list.length && <p className="text-muted-foreground">{t("noReservations")}</p>}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid gap-2">
          {list.map((r) => (
            <button key={r.id} type="button" onClick={() => setSel(r.id)}
              className={`grid gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:border-secondary ${sel === r.id ? "border-secondary" : "border-border"}`}>
              <div className="font-medium"><span className="font-display">{fmtTime(r.starts_at)}</span> · {r.code} · {r.companies?.name}</div>
              <StatusBadges status={r.status} rescheduled={r.rescheduled} penalty={r.penalty} />
            </button>
          ))}
        </div>
        {list.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4">
            {cur ? <><p className="mb-2 text-xs text-muted-foreground">{cur.code} · {cur.companies?.name}</p>{children(cur)}</>
              : <p className="text-sm text-muted-foreground">{t("pickDelivery")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
