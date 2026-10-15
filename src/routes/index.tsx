import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, Building2, ArrowRight } from "lucide-react";
import dock from "@/assets/login-dock.jpg";
import logoSrc from "@/assets/logidex-logo-clear.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LangSwitcher, useI18n } from "@/lib/i18n";
import { usernameToEmail } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactCard } from "@/components/AppShell";
import { useSettings } from "@/hooks/use-me";
import { bootstrapDemoAccounts } from "@/lib/admin.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LOGIDEX — La logística bajo control" },
      { name: "description", content: "Reserva y gestión de citas de descarga para transportistas y personal de almacén." },
      { property: "og:title", content: "LOGIDEX — La logística bajo control" },
      { property: "og:description", content: "Reserva y gestión de citas de descarga para transportistas y personal de almacén." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const settings = useSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"carrier" | "staff">("carrier");

  useEffect(() => {
    bootstrapDemoAccounts().catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio" });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/inicio" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(t("error"));
  }

  async function staffLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setBusy(false);
    if (error) toast.error(t("badCredentials"));
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <img src={dock} alt="" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/30 to-primary/80" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div>
            <p className="max-w-sm font-display text-5xl font-semibold leading-tight">{t("tagline")}</p>
            <span className="mt-6 block h-1 w-16 rounded-full bg-secondary" />
          </div>
          <p className="text-sm uppercase tracking-widest text-primary-foreground/80">{t("welcome")}</p>
        </div>
      </aside>

      <main className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex justify-end"><LangSwitcher /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="flex flex-col items-center text-center">
            <img src={logoSrc} alt="LOGIDEX" className="h-14 w-auto sm:h-16" />
            <p className="mt-3 font-display text-lg text-muted-foreground lg:hidden">{t("tagline")}</p>
          </div>

          <div role="tablist" className="mt-10 grid grid-cols-2 border-b border-border">
            {([["carrier", Truck, t("carriers")], ["staff", Building2, t("staff")]] as const).map(([k, Icon, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={mode === k}
                onClick={() => setMode(k)}
                className={`-mb-px flex items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition-colors ${mode === k ? "border-secondary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            {mode === "carrier" ? (
              <div className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">{t("carriersHint")}</p>
                <Button onClick={google} variant="outline" size="lg" className="h-12 w-full gap-3 bg-card">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.5 10.5 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
                  {t("google")}
                </Button>
              </div>
            ) : (
              <form onSubmit={staffLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="u">{t("username")}</Label>
                  <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required className="h-11 bg-card" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p">{t("password")}</Label>
                  <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="h-11 bg-card" />
                </div>
                <Button type="submit" disabled={busy} size="lg" className="h-12 w-full gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  {t("signIn")} <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>

          <div className="mt-10">
            <ContactCard phone={settings.data?.contact_phone} email={settings.data?.contact_email} />
          </div>
        </div>
      </main>
    </div>
  );
}
