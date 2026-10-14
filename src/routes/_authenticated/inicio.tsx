import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useSettings } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { menuForRoles } from "@/lib/roles";
import { AppShell, ContactCard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Inicio — LOGIDEX" }, { name: "description", content: "Panel de LOGIDEX" }] }),
  component: Home,
});

function Home() {
  const { t } = useI18n();
  const me = useMe();
  const settings = useSettings();
  if (me.isLoading || !me.data) return <AppShell><p className="text-muted-foreground">…</p></AppShell>;
  const { profile, roles, lastRequest } = me.data;
  const contact = <ContactCard phone={settings.data?.contact_phone} email={settings.data?.contact_email} />;
  const name = profile?.full_name ?? profile?.username ?? profile?.email;

  if (profile?.status === "disabled")
    return <AppShell name={name}><Panel title={t("disabledText")}>{contact}</Panel></AppShell>;
  if (profile?.must_change_password) return <AppShell name={name}><ChangePassword /></AppShell>;
  if (!profile?.is_internal && profile?.status !== "active") {
    if (lastRequest?.status === "pending")
      return (
        <AppShell name={name}>
          <Panel title={t("pendingTitle")} icon>
            <p className="text-muted-foreground">{t("pendingText")}</p>
            {contact}
          </Panel>
        </AppShell>
      );
    return (
      <AppShell name={name}>
        <Onboarding rejected={lastRequest?.status === "rejected"} />
        <div className="mx-auto mt-6 max-w-lg">{contact}</div>
      </AppShell>
    );
  }

  const items = menuForRoles(roles, profile?.can_scan_qr);
  return (
    <AppShell name={name}>
      <h1 className="font-display text-2xl font-semibold">{t("hello")}, {name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{roles.map((r) => t(`role_${r}`)).join(" · ")}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) =>
          i.to ? (
            <Link key={i.key} to={i.to} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-secondary">
              <div className="font-display font-semibold">{t(i.key)}</div>
            </Link>
          ) : (
            <div key={i.key} className="rounded-xl border border-dashed border-border bg-card/60 p-5">
              <div className="font-display font-semibold">{t(i.key)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t("comingSoon")}</div>
            </div>
          ),
        )}
      </div>
    </AppShell>
  );
}

function Panel({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: boolean }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        {icon && <Clock className="h-5 w-5 text-warning" />}
        <h1 className="font-display text-lg font-semibold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

function Onboarding({ rejected }: { rejected: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", tax: "", phone: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("submit_company_registration", { _name: f.name, _tax_id: f.tax, _phone: f.phone });
    setBusy(false);
    if (error) { toast.error(t("error")); return; }
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <Panel title={t("onboardTitle")}>
      {rejected && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{t("rejectedText")}</p>}
      <p className="text-sm text-muted-foreground">{t("onboardText")}</p>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t("companyName")} value={f.name} onChange={(v) => setF({ ...f, name: v })} />
        <Field label={t("taxId")} value={f.tax} onChange={(v) => setF({ ...f, tax: v })} />
        <Field label={t("phone")} value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
        <Button type="submit" disabled={busy} className="w-full">{t("send")}</Button>
      </form>
    </Panel>
  );
}

function ChangePassword() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [cur, setCur] = useState("");
  const [pwd, setPwd] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) { toast.error(t("changePwdText")); return; }
    const { error } = await supabase.auth.updateUser({ password: pwd, current_password: cur } as never);
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("complete_password_change");
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <Panel title={t("changePwdTitle")}>
      <p className="text-sm text-muted-foreground">{t("changePwdText")}</p>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t("currentPwd")} value={cur} onChange={setCur} type="password" />
        <Field label={t("newPwd")} value={pwd} onChange={setPwd} type="password" />
        <Button type="submit" className="w-full">{t("save")}</Button>
      </form>
    </Panel>
  );
}

export function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}
