import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import logoSrc from "@/assets/logidex-logo-a.png";
import { supabase } from "@/integrations/supabase/client";
import { LangSwitcher, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMe } from "@/hooks/use-me";
import { menuForRoles } from "@/lib/roles";
import { NotificationBell } from "@/components/NotificationBell";

function NavList({ onPick }: { onPick?: () => void }) {
  const { t } = useI18n();
  const me = useMe();
  const path = useRouterState({ select: (st) => st.location.pathname });
  const p = me.data?.profile;
  if (!me.data || p?.status !== "active" || p.must_change_password) return null;
  const items = menuForRoles(me.data.roles);
  return (
    <nav className="flex flex-col gap-1">
      {items.map((i) => i.to && (
        <Link key={i.key} to={i.to} onClick={onPick} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${i.key === "menu_admin" ? (path.startsWith("/admin") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground") : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          activeProps={i.key === "menu_admin" ? {} : { className: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" }}>{t(i.key)}</Link>
      ))}
    </nav>
  );
}

export function AppShell({ children, name }: { children: ReactNode; name?: string | null | undefined }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
  const [open, setOpen] = useState(false);
  const me = useMe();
  const mp = me.data?.profile;
  // Hide navigation when the user has a single screen (e.g. carriers): nothing to switch to.
  const showNav = !!me.data && mp?.status === "active" && !mp.must_change_password && menuForRoles(me.data.roles).length > 1;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className={showNav ? "lg:hidden" : "hidden"} aria-label={t("menu")} onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
          <Link to="/inicio" className="flex items-center gap-3">
            <img src={logoSrc} alt="LOGIDEX" className="h-10 w-auto" />
          </Link>
          </div>
          <div className="flex items-center gap-3">
            {name && <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>}
            <NotificationBell />
            <LangSwitcher />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" />
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4">
        {showNav && <aside className="hidden w-56 shrink-0 border-r border-border py-8 pr-4 lg:block"><div className="sticky top-4"><NavList /></div></aside>}
        <main className="min-w-0 flex-1 py-8">{children}</main>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64">
          <SheetHeader><SheetTitle><img src={logoSrc} alt="LOGIDEX" className="h-10 w-auto" /></SheetTitle></SheetHeader>
          <div className="mt-6"><NavList onPick={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function ContactCard({ phone, email }: { phone?: string | undefined; email?: string | undefined }) {
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
