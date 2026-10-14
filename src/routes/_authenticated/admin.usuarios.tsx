import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { ASSIGNABLE_ROLES, type AppRole } from "@/lib/roles";
import { createInternalUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({ component: Users });

function Users() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const create = useServerFn(createInternalUser);
  const [f, setF] = useState({ username: "", fullName: "", password: "", role: "administrativo" as AppRole });
  const q = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }, { data: comps }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("companies").select("id, name"),
      ]);
      return (profs ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
        company: comps?.find((c) => c.id === p.company_id)?.name,
      }));
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: f });
      toast.success(t("saved"));
      setF({ ...f, username: "", fullName: "", password: "" });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    }
  }
  async function update(id: string, status: string | null, canScan: boolean | null) {
    const { error } = await supabase.rpc("admin_update_user", { _user_id: id, _status: status as string, _can_scan: canScan as boolean });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["users"] });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-5 sm:items-end">
        <h2 className="font-display font-semibold sm:col-span-5">{t("createInternal")}</h2>
        <div className="space-y-1"><Label>{t("username")}</Label><Input required value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
        <div className="space-y-1"><Label>{t("fullName")}</Label><Input required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
        <div className="space-y-1"><Label>{t("tempPwd")}</Label><Input required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div className="space-y-1">
          <Label>{t("role")}</Label>
          <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as AppRole })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{t(`role_${r}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="submit">{t("create")}</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fullName")}</TableHead>
              <TableHead>{t("username")} / {t("email")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name}<div className="text-xs text-muted-foreground">{u.company}</div></TableCell>
                <TableCell className="text-sm">{u.is_internal ? u.username : u.email}</TableCell>
                <TableCell className="text-sm">{u.roles.filter((r): r is AppRole => (ASSIGNABLE_ROLES as string[]).includes(r)).map((r) => t(`role_${r}`)).join(", ") || "—"}</TableCell>
                <TableCell><Badge variant={u.status === "active" ? "default" : "outline"}>{t(`st_${u.status}` as never)}</Badge></TableCell>
                <TableCell>
                  {u.status === "disabled" ? (
                    <Button size="sm" variant="outline" onClick={() => update(u.id, "active", null)}>{t("activate")}</Button>
                  ) : u.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => update(u.id, "disabled", null)}>{t("deactivate")}</Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
