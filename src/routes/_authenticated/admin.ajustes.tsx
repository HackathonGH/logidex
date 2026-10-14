import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/ajustes")({ component: Settings });

function Settings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const s = useSettings();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (s.data) { setPhone(s.data.contact_phone); setEmail(s.data.contact_email); }
  }, [s.data]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("admin_update_settings", { _phone: phone, _email: email });
    if (error) return toast.error(t("error"));
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["settings"] });
  }
  return (
    <form onSubmit={save} className="max-w-md space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display font-semibold">{t("contactAdmin")}</h2>
      <div className="space-y-1"><Label>{t("phone")}</Label><Input required value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="space-y-1"><Label>{t("email")}</Label><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <Button type="submit">{t("save")}</Button>
    </form>
  );
}
