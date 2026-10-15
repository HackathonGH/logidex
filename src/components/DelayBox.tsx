import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { errorCode, toMadrid } from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Human decision on a delayed truck: keep, reschedule (suggested slots, never auto-confirmed) or no-show. */
export function DelayBox({ id, alerted, onNoShow }: { id: string; alerted: boolean; onNoShow: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [mode, setMode] = useState(false);
  const [date, setDate] = useState(() => toMadrid(new Date()).date);
  const [busy, setBusy] = useState(false);
  const slots = useQuery({
    queryKey: ["staff-slots", id, date],
    enabled: mode,
    queryFn: async () => { const { data, error } = await supabase.rpc("staff_available_slots", { _id: id, _date: date }); if (error) throw error; return (data ?? []) as string[]; },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ops"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); };
  async function call(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); slots.refetch(); return; }
    toast.success(t("saved")); setMode(false); refresh();
  }
  return (
    <section className="space-y-3 rounded-md border border-warning/50 bg-warning/10 p-3">
      <div className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-warning" />{t("delayTitle")}</div>
      <div className="flex flex-wrap gap-2">
        {alerted && <Button size="sm" variant="outline" disabled={busy} onClick={() => call(() => supabase.rpc("staff_keep_delayed", { _id: id }))}>{t("keepWaiting")}</Button>}
        <Button size="sm" variant={mode ? "default" : "outline"} disabled={busy} onClick={() => setMode(!mode)}>{t("reschedule")}</Button>
        <Button size="sm" variant="outline" className="border-destructive/40 text-destructive" disabled={busy} onClick={onNoShow}>{t("act_no_show")}</Button>
      </div>
      {mode && (
        <div className="space-y-2">
          <Input type="date" className="w-44" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <div className="text-xs text-muted-foreground">{t("suggestedSlots")}</div>
          {slots.data && !slots.data.length && <p className="text-sm text-muted-foreground">{t("noSlots")}</p>}
          <div className="flex flex-wrap gap-1">
            {slots.data?.map((s) => (
              <Button key={s} size="sm" variant="outline" disabled={busy}
                onClick={() => { if (window.confirm(`${t("rescheduleConfirm")} ${date} ${s}`)) call(() => supabase.rpc("staff_reschedule", { _id: id, _date: date, _time: s })); }}>{s}</Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
