import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, Building2 } from "lucide-react";
import logo from "@/assets/logidex-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LangSwitcher, useI18n } from "@/lib/i18n";
import { usernameToEmail } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactCard } from "@/components/AppShell";
import { useSettings } from "@/hooks/use-me";

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl justify-end px-4 pt-4">
        <LangSwitcher />
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <div className="flex flex-col items-center text-center">
          <img src={logo.url} alt="LOGIDEX" className="h-16 w-auto sm:h-20" />
          <p className="mt-4 font-display text-xl font-semibold text-secondary">{t("tagline")}</p>
          <h1 className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">{t("welcome")}</h1>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-accent p-2 text-primary"><Truck className="h-5 w-5" /></span>
              <h2 className="font-display text-lg font-semibold">{t("carriers")}</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("carriersHint")}</p>
            <div className="mt-auto pt-6">
              <Button onClick={google} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" size="lg">
                {t("google")}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-primary p-6 text-primary-foreground shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-primary-foreground/10 p-2"><Building2 className="h-5 w-5" /></span>
              <h2 className="font-display text-lg font-semibold">{t("staff")}</h2>
            </div>
            <form onSubmit={staffLogin} className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="u" className="text-primary-foreground/80">{t("username")}</Label>
                <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required className="bg-card text-foreground" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p" className="text-primary-foreground/80">{t("password")}</Label>
                <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="bg-card text-foreground" />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                {t("signIn")}
              </Button>
            </form>
          </section>
        </div>

        <div className="mx-auto mt-8 max-w-md">
          <ContactCard phone={settings.data?.contact_phone} email={settings.data?.contact_email} />
        </div>
      </div>
    </div>
  );
}
