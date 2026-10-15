import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bell, Clock, Euro } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useI18n, type TKey } from "@/lib/i18n";
import { fmtTime, toMadrid } from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICON = { delay: Clock, late_cancel: Euro, incident: AlertTriangle } as const;

/** Internal notification centre for admin/administrativo. Also triggers the +15 min delay check every minute. */
export function NotificationBell() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useMe();
  const roles = me.data?.roles ?? [];
  const staff = (roles.includes("admin") || roles.includes("administrativo")) && me.data?.profile?.status === "active";
  const uid = me.data?.user.id;

  const q = useQuery({
    queryKey: ["notifications"],
    enabled: staff,
    queryFn: async () => {
      const [{ data: list }, { data: reads }] = await Promise.all([
        supabase.from("notifications").select("*, reservations(code, starts_at, companies(name))").order("created_at", { ascending: false }).limit(40),
        supabase.from("notification_reads").select("notification_id"),
      ]);
      const read = new Set((reads ?? []).map((r) => r.notification_id));
      return (list ?? []).map((n) => ({ ...n, read: read.has(n.id) }));
    },
  });

  useEffect(() => {
    if (!staff) return;
    const tick = async () => {
      const { data } = await supabase.rpc("staff_detect_delays");
      if (data) { qc.invalidateQueries({ queryKey: ["ops"] }); }
    };
    tick();
    const iv = setInterval(tick, 60_000);
    const ch = supabase.channel("notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [staff, qc]);

  if (!staff) return null;
  const list = q.data ?? [];
  const unread = list.filter((n) => !n.read);

  async function markRead(ids: string[]) {
    if (!uid || !ids.length) return;
    await supabase.from("notification_reads").upsert(ids.map((id) => ({ user_id: uid, notification_id: id })), { ignoreDuplicates: true });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications")}>
          <Bell className="h-5 w-5" />
          {unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="font-display font-semibold">{t("notifications")}</span>
          {unread.length > 0 && <button type="button" className="text-xs text-secondary hover:underline" onClick={() => markRead(unread.map((n) => n.id))}>{t("markAllRead")}</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!list.length && <p className="p-4 text-sm text-muted-foreground">{t("noNotifications")}</p>}
          {list.map((n) => {
            const Icon = ICON[n.kind as keyof typeof ICON] ?? Bell;
            return (
              <button key={n.id} type="button" onClick={() => { markRead([n.id]); if (n.kind === "incident") navigate({ to: "/incidencias" });
                else navigate({ to: "/operaciones", search: { open: n.reservation_id, date: n.reservations ? toMadrid(new Date(n.reservations.starts_at)).date : undefined } }); }}
                className={`flex w-full gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted ${n.read ? "opacity-60" : ""}`}>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.kind === "delay" ? "text-warning" : n.kind === "incident" ? "text-destructive" : "text-secondary"}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t(`n_${n.kind}` as TKey)}{n.resolved_at ? ` · ${t("n_resolved")}` : ""}</div>
                  <div className="truncate text-xs text-muted-foreground">{n.reservations?.code} · {n.reservations?.companies?.name}{n.reservations ? ` · ${fmtTime(n.reservations.starts_at)}` : ""}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString(lang, { timeZone: "Europe/Madrid" })} {fmtTime(n.created_at)}</div>
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
