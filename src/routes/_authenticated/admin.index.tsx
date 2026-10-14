import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Requests });

function Requests() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["link-requests"],
    queryFn: async () => {
      const { data: reqs } = await supabase.from("company_link_requests").select("*, companies(name, tax_id, phone)").eq("status", "pending").order("created_at");
      const ids = (reqs ?? []).map((r) => r.user_id);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
      return (reqs ?? []).map((r) => ({ ...r, profile: profs?.find((p) => p.id === r.user_id) }));
    },
  });
  async function review(id: string, approve: boolean) {
    const { error } = await supabase.rpc("review_link_request", { _request_id: id, _approve: approve });
    if (error) return toast.error(t("error"));
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["link-requests"] });
  }
  if (!q.data?.length) return <p className="text-muted-foreground">{q.isLoading ? "…" : t("noRequests")}</p>;
  return (
    <div className="space-y-3">
      {q.data.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {r.companies?.name}
              <Badge variant="outline">{r.is_new_company ? t("newCompany") : t("linkCompany")}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{r.companies?.tax_id} · {r.companies?.phone}</div>
            <div className="text-sm">{r.profile?.full_name} — {r.profile?.email}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => review(r.id, true)}>{t("approve")}</Button>
            <Button size="sm" variant="destructive" onClick={() => review(r.id, false)}>{t("reject")}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
