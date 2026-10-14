import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import logo from "@/assets/logidex-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { LangSwitcher, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function AppShell({ children, name }: { children: ReactNode; name?: string | null }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/inicio" className="flex items-center gap-3">
            <img src={logo.url} alt="LOGIDEX" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            {name && <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>}
            <LangSwitcher />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" />
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function ContactCard({ phone, email }: { phone?: string; email?: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
      <div className="font-semibold text-foreground">{t("contactAdmin")}</div>
      <div className="mt-1 text-muted-foreground">
        {t("phone")}: <a className="text-foreground underline" href={`tel:${phone?.replace(/\s/g, "")}`}>{phone}</a>
      </div>
      <div className="text-muted-foreground">
        {t("email")}: <a className="text-foreground underline" href={`mailto:${email}`}>{email}</a>
      </div>
    </div>
  );
}
