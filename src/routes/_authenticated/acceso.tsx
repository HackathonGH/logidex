import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useI18n, type TKey } from "@/lib/i18n";
import { fmtDateTime, fmtTime, errorCode } from "@/lib/reservations";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QrScanner = lazy(() => import("@/components/QrScanner"));

export const Route = createFileRoute("/_authenticated/acceso")({
  head: () => ({ meta: [{ title: "Control de accesos — LOGIDEX" }, { name: "description", content: "Escaneo del QR y registro de llegada" }] }),
  component: Gate,
});

type Found = { id: string; code: string; company: string; starts_at: string; ends_at: string; driver_name: string; driver_doc: string | null; tractor_plate: string; trailer_plate: string | null; status: string; valid: boolean };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Gate() {
  const { t, lang } = useI18n();
  const me = useMe();
  const [manual, setManual] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [done, setDone] = useState(false);
  const [camErr, setCamErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const roles = me.data?.roles ?? [];
  const p = me.data?.profile;
  const ok = (roles.includes("admin") || roles.includes("administrativo") || roles.includes("control_accesos")) && p?.status === "active" && !p?.must_change_password;

  async function lookup(raw: string) {
    const v = raw.trim();
    if (busy || v === token) return;
    if (!UUID_RE.test(v)) { toast.error(t("ERR_QR_UNKNOWN")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("gate_lookup", { _token: v });
    setBusy(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    if (!data?.length) { toast.error(t("ERR_QR_UNKNOWN")); return; }
    setToken(v); setFound(data[0] as Found); setDone(false);
  }
  async function arrive() {
    if (!token) return;
    setBusy(true);
    const { error } = await supabase.rpc("gate_register_arrival", { _token: token });
    setBusy(false);
    if (error) { toast.error(t(errorCode(error.message) as TKey)); return; }
    setDone(true); toast.success(t("arrivalDone"));
  }
  const reset = () => { setToken(null); setFound(null); setDone(false); setManual(""); };

  return (
    <AppShell name={p?.full_name ?? p?.username}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{t("menu_scan")}</h1>
      </div>
      {me.isLoading ? <p className="text-muted-foreground">…</p> : !ok ? <p>{t("noAccess")}</p> : (
        <div className="mx-auto max-w-md space-y-4">
          {!found ? (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <p className="p-3 text-center font-medium">{t("scanTitle")}</p>
                {camErr ? <p className="p-4 text-center text-sm text-muted-foreground">{t("cameraError")}</p> : (
                  <ClientOnly fallback={<div className="aspect-square bg-muted" />}>
                    <Suspense fallback={<div className="aspect-square bg-muted" />}>
                      <QrScanner onCode={lookup} onError={() => setCamErr(true)} />
                    </Suspense>
                  </ClientOnly>
                )}
              </div>
              <form className="space-y-1" onSubmit={(e) => { e.preventDefault(); lookup(manual); }}>
                <Label>{t("manualCode")}</Label>
                <div className="flex gap-2"><Input value={manual} onChange={(e) => setManual(e.target.value)} /><Button type="submit" disabled={busy}>{t("lookup")}</Button></div>
              </form>
            </>
          ) : (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-semibold">{found.code}</div>
                {found.valid || done
                  ? <CheckCircle2 className="h-6 w-6 text-success" />
                  : <span className="flex items-center gap-1 text-sm text-destructive"><ShieldAlert className="h-5 w-5" />{t("qrInvalid")}</span>}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("company")}</dt><dd>{found.company}</dd>
                <dt className="text-muted-foreground">{t("scheduled")}</dt><dd>{fmtDateTime(found.starts_at, lang)} – {fmtTime(found.ends_at)}</dd>
                <dt className="text-muted-foreground">{t("driver")}</dt><dd className="font-semibold">{found.driver_name}</dd>
                <dt className="text-muted-foreground">{t("driverDoc")}</dt><dd className="font-mono text-base font-semibold">{found.driver_doc ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("tractorPlate")}</dt><dd>{found.tractor_plate}</dd>
                <dt className="text-muted-foreground">{t("trailerPlate")}</dt><dd>{found.trailer_plate ?? "—"}</dd>
              </dl>
              {done ? (
                <p className="rounded-md bg-success/10 p-3 text-sm font-medium text-success">{t("arrivalDone")} · {t("carrierWaiting")}</p>
              ) : found.valid ? (
                <>
                  <p className="text-sm">{t("checkId")}</p>
                  <Button className="w-full" size="lg" disabled={busy} onClick={arrive}>{t("idMatches")}</Button>
                  <p className="text-xs text-muted-foreground">{t("idMismatch")}</p>
                </>
              ) : (
                <p className="text-sm text-destructive">{t("ERR_QR_INVALID")}</p>
              )}
              <Button variant="outline" className="w-full" onClick={reset}>{t("scanAnother")}</Button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
