import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, Pencil, Plus, Trash2, Unlock, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { TIME_SLOTS, toMadrid, madridToISO, fmtDateTime, errorCode } from "@/lib/reservations";
import { StaffPage } from "@/components/StaffPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/bloqueos")({
  head: () => ({ meta: [{ title: "Bloqueos y capacidad — LOGIDEX" }, { name: "description", content: "Bloqueos de muelles, palets por turno y festivos" }] }),
  component: () => (
    <StaffPage title="menu_blocks">
      {({ isAdmin }) => (
        <Tabs defaultValue="blocks">
          <TabsListI18n />
          <TabsContent value="blocks"><BlocksTab /></TabsContent>
          <TabsContent value="capacity"><CapacityTab /></TabsContent>
          <TabsContent value="holidays"><HolidaysTab isAdmin={isAdmin} /></TabsContent>
          <TabsContent value="calendar"><CalendarTab /></TabsContent>
        </Tabs>
      )}
    </StaffPage>
  ),
});

function TabsListI18n() {
  const { t } = useI18n();
  return (
    <TabsList className="mb-4 flex-wrap">
      <TabsTrigger value="blocks">{t("tab_blocks")}</TabsTrigger>
      <TabsTrigger value="capacity">{t("tab_capacity")}</TabsTrigger>
      <TabsTrigger value="holidays">{t("tab_holidays")}</TabsTrigger>
      <TabsTrigger value="calendar">{t("tab_calendar")}</TabsTrigger>
    </TabsList>
  );
}

const fail = (t: (k: TKey) => string, msg?: string) => toast.error(t(errorCode(msg) as TKey));

/* ---------------- Blocks ---------------- */
type BlockForm = { id: string | null; dock: string; kind: "technical" | "organizational"; sDate: string; sTime: string; eDate: string; eTime: string; reason: string; recurrence: "none" | "daily" | "weekly"; until: string };

function BlocksTab() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const today = toMadrid(new Date()).date;
  const empty: BlockForm = { id: null, dock: "all", kind: "technical", sDate: today, sTime: "08:00", eDate: today, eTime: "10:00", reason: "", recurrence: "none", until: "" };
  const [form, setForm] = useState<BlockForm | null>(null);
  const [affected, setAffected] = useState<{ code: string; starts_at: string }[] | null>(null);
  const docks = useQuery({ queryKey: ["docks"], queryFn: async () => (await supabase.from("docks").select("*").order("id")).data ?? [] });
  const blocks = useQuery({ queryKey: ["blocks"], queryFn: async () => (await supabase.from("blocks").select("*").order("starts_at", { ascending: false })).data ?? [] });

  function payload(f: BlockForm) {
    return {
      _dock: f.dock === "all" ? null : Number(f.dock), _start: madridToISO(f.sDate, f.sTime), _end: madridToISO(f.eDate, f.eTime),
      _recurrence: f.recurrence, _until: f.recurrence === "none" || !f.until ? null : f.until,
    };
  }
  async function check() {
    if (!form) return;
    if (!form.reason.trim()) { toast.error(t("ERR_REASON")); return; }
    const p = payload(form);
    if (p._end <= p._start) { toast.error(t("ERR_RANGE")); return; }
    const { data, error } = await supabase.rpc("block_affected", p as never);
    if (error) { fail(t, error.message); return; }
    if (data?.length) setAffected(data);
    else await persist();
  }
  async function persist() {
    if (!form) return;
    const { error } = await supabase.rpc("admin_save_block", { _id: form.id, _kind: form.kind, _reason: form.reason, ...payload(form) } as never);
    if (error) { fail(t, error.message); return; }
    toast.success(t("saved"));
    setAffected(null);
    setForm(null);
    qc.invalidateQueries({ queryKey: ["blocks"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.rpc("admin_delete_block", { _id: id });
    if (error) { fail(t, error.message); return; }
    qc.invalidateQueries({ queryKey: ["blocks"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  }
  function edit(b: NonNullable<typeof blocks.data>[number]) {
    const s = toMadrid(b.starts_at), e = toMadrid(b.ends_at);
    setForm({ id: b.id, dock: b.dock_id ? String(b.dock_id) : "all", kind: b.kind as BlockForm["kind"], sDate: s.date, sTime: s.time, eDate: e.date, eTime: e.time, reason: b.reason, recurrence: b.recurrence as BlockForm["recurrence"], until: b.recurrence_until ?? "" });
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setForm(empty)}><Plus className="mr-1 h-4 w-4" />{t("newBlock")}</Button>
      <div className="space-y-2">
        {!blocks.isLoading && !blocks.data?.length && <p className="text-sm text-muted-foreground">{t("noBlocks")}</p>}
        {blocks.data?.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                <Ban className="h-4 w-4 text-destructive" />
                {b.dock_id ? docks.data?.find((d) => d.id === b.dock_id)?.name : t("allDocks")}
                <Badge variant="outline">{t(`kind_${b.kind}` as TKey)}</Badge>
                {b.recurrence !== "none" && <Badge variant="outline">{t(`rec_${b.recurrence}` as TKey)}{b.recurrence_until ? ` → ${b.recurrence_until}` : ""}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">{fmtDateTime(b.starts_at, lang)} → {fmtDateTime(b.ends_at, lang)}</div>
              <div className="text-sm">{b.reason}</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => edit(b)}><Pencil className="mr-1 h-4 w-4" />{t("edit")}</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(b.id)}><Trash2 className="mr-1 h-4 w-4" />{t("delete")}</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? t("editBlock") : t("newBlock")}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("kind")}</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as BlockForm["kind"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">{t("kind_technical")}</SelectItem>
                    <SelectItem value="organizational">{t("kind_organizational")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("scope")}</Label>
                <Select value={form.dock} onValueChange={(v) => setForm({ ...form, dock: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allDocks")}</SelectItem>
                    {docks.data?.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DateTime label={t("start")} date={form.sDate} time={form.sTime} onChange={(d, tm) => setForm({ ...form, sDate: d, sTime: tm })} />
              <DateTime label={t("end")} date={form.eDate} time={form.eTime} onChange={(d, tm) => setForm({ ...form, eDate: d, eTime: tm })} />
              <div className="space-y-1">
                <Label>{t("recurrence")}</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as BlockForm["recurrence"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["none", "daily", "weekly"] as const).map((r) => <SelectItem key={r} value={r}>{t(`rec_${r}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.recurrence !== "none" && (
                <div className="space-y-1"><Label>{t("until")}</Label><Input type="date" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} /></div>
              )}
              <div className="space-y-1 sm:col-span-2"><Label>{t("reason")}</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>{t("close")}</Button>
            <Button onClick={check}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!affected} onOpenChange={(o) => !o && setAffected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("affectedTitle")}</DialogTitle>
            <DialogDescription>{t("affectedText")}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
            {affected?.map((a) => <li key={a.code}><strong>{a.code}</strong> · {fmtDateTime(a.starts_at, lang)}</li>)}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAffected(null)}>{t("close")}</Button>
            <Button onClick={persist}>{t("saveAnyway")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DateTime({ label, date, time, onChange }: { label: string; date: string; time: string; onChange: (d: string, t: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input type="date" value={date} onChange={(e) => onChange(e.target.value, time)} />
        <Select value={time} onValueChange={(v) => onChange(date, v)}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-64">{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ---------------- Capacity ---------------- */
const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function CapacityTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shifts = useQuery({ queryKey: ["shifts"], queryFn: async () => (await supabase.from("shifts").select("*").order("sort")).data ?? [] });
  const overrides = useQuery({
    queryKey: ["overrides"],
    queryFn: async () => (await supabase.from("shift_capacity_overrides").select("*").gte("service_date", toMadrid(new Date()).date).order("service_date")).data ?? [],
  });
  const [defs, setDefs] = useState<Record<string, string>>({});
  const [ov, setOv] = useState({ date: "", shift: "morning", max: "" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["shifts"] }); qc.invalidateQueries({ queryKey: ["overrides"] }); qc.invalidateQueries({ queryKey: ["calendar"] }); };

  async function saveDefault(code: string) {
    const v = Number(defs[code]);
    if (!Number.isInteger(v) || v < 0) { toast.error(t("ERR_PALLETS")); return; }
    const { error } = await supabase.rpc("admin_set_shift_default", { _code: code, _max: v });
    if (error) { fail(t, error.message); return; }
    toast.success(t("saved"));
    setDefs((d) => { const n = { ...d }; delete n[code]; return n; });
    refresh();
  }
  async function setOverride(date: string, code: string, max: number | null) {
    const { error } = await supabase.rpc("admin_set_capacity_override", { _date: date, _code: code, _max: max as number });
    if (error) { fail(t, error.message); return; }
    toast.success(t("saved"));
    refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display font-semibold">{t("defaultMax")}</h2>
        {shifts.data?.map((s) => (
          <div key={s.code} className="flex items-end gap-3">
            <div className="flex-1">
              <div className="font-medium">{t(`sh_${s.code}` as TKey)}</div>
              <div className="text-xs text-muted-foreground">{minToHHMM(s.start_min)}–{minToHHMM(s.end_min)}</div>
            </div>
            <Input type="number" min={0} className="w-28" value={defs[s.code] ?? String(s.default_max_pallets)} onChange={(e) => setDefs({ ...defs, [s.code]: e.target.value })} aria-label={t("maxPallets")} />
            <Button size="sm" disabled={defs[s.code] === undefined} onClick={() => saveDefault(s.code)}>{t("save")}</Button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display font-semibold">{t("dateExceptions")}</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
          <div className="space-y-1"><Label className="text-xs">{t("date")}</Label><Input type="date" value={ov.date} onChange={(e) => setOv({ ...ov, date: e.target.value })} /></div>
          <div className="space-y-1">
            <Label className="text-xs">{t("shift")}</Label>
            <Select value={ov.shift} onValueChange={(v) => setOv({ ...ov, shift: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{shifts.data?.map((s) => <SelectItem key={s.code} value={s.code}>{t(`sh_${s.code}` as TKey)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t("maxPallets")}</Label><Input type="number" min={0} value={ov.max} onChange={(e) => setOv({ ...ov, max: e.target.value })} /></div>
          <Button disabled={!ov.date || ov.max === ""} onClick={async () => { await setOverride(ov.date, ov.shift, Number(ov.max)); setOv({ ...ov, max: "" }); }}>{t("addException")}</Button>
        </div>
        {!overrides.data?.length && <p className="text-sm text-muted-foreground">{t("noExceptions")}</p>}
        {overrides.data?.map((o) => (
          <div key={o.service_date + o.shift_code} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>{o.service_date} · {t(`sh_${o.shift_code}` as TKey)}</span>
            <span className="flex items-center gap-2"><strong>{o.max_pallets}</strong>
              <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setOverride(o.service_date, o.shift_code, null)}><Trash2 className="h-4 w-4" /></Button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------------- Holidays ---------------- */
function HolidaysTab({ isAdmin }: { isAdmin: boolean }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["holidays"], queryFn: async () => (await supabase.from("holidays").select("*").order("day")).data ?? [] });
  async function toggle(day: string, open: boolean) {
    const { error } = await supabase.rpc("admin_set_holiday_open", { _day: day, _open: open });
    if (error) { fail(t, error.message); return; }
    qc.invalidateQueries({ queryKey: ["holidays"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  }
  const fmt = (d: string) => new Intl.DateTimeFormat(lang, { dateStyle: "full", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("holidaysHint")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.data?.map((h) => (
          <div key={h.day} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div>
              <div className="font-medium">{h.name}</div>
              <div className="text-xs capitalize text-muted-foreground">{fmt(h.day)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={h.is_open ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}>
                {h.is_open ? <Unlock className="mr-1 h-3 w-3" /> : <Lock className="mr-1 h-3 w-3" />}
                {h.is_open ? t("holidayOpen") : t("holidayClosed")}
              </Badge>
              {isAdmin && <Button size="sm" variant="outline" onClick={() => toggle(h.day, !h.is_open)}>{h.is_open ? t("closeHoliday") : t("openHoliday")}</Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Calendar ---------------- */
function CalendarTab() {
  const { t, lang } = useI18n();
  const now = toMadrid(new Date()).date;
  const [month, setMonth] = useState(now.slice(0, 7));
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = `${month}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${month}-${String(days).padStart(2, "0")}`;
  const q = useQuery({
    queryKey: ["calendar", month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calendar_summary", { _from: first, _to: last });
      if (error) throw error;
      return data ?? [];
    },
  });
  const shift = (delta: number) => { const d = new Date(Date.UTC(y, m - 1 + delta, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const byDay = new Map<string, NonNullable<typeof q.data>>();
  q.data?.forEach((r) => byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + i))));
  const title = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(first + "T00:00:00Z")).replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" aria-label={t("prev")} onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="min-w-40 text-center font-display font-semibold">{title}</div>
        <Button size="icon" variant="outline" aria-label={t("next")} onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {weekdays.map((w) => <div key={w} className="px-1 py-1 font-semibold capitalize text-muted-foreground">{w}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
          const rows = byDay.get(d) ?? [];
          const hol = rows[0]?.holiday_name;
          const closed = hol && !rows[0]?.holiday_open;
          const blocks = rows[0]?.blocks ?? 0;
          return (
            <div key={d} className={`min-h-28 rounded-md border p-1.5 ${closed ? "border-destructive/40 bg-destructive/5" : d === now ? "border-secondary bg-card" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between font-semibold">
                <span>{i + 1}</span>
                {blocks > 0 && <span className="flex items-center gap-0.5 text-destructive" title={t("blocksCount")}><Ban className="h-3 w-3" />{blocks}</span>}
              </div>
              {hol && (
                <div className={`mt-0.5 flex items-center gap-1 leading-tight ${closed ? "text-destructive" : "text-success"}`}>
                  {closed ? <Lock className="h-3 w-3 shrink-0" /> : <Unlock className="h-3 w-3 shrink-0" />}
                  <span className="truncate" title={hol}>{hol}</span>
                </div>
              )}
              {!closed && (
                <div className="mt-1 space-y-0.5">
                  {rows.map((r) => {
                    const pct = r.max_pallets ? r.used / r.max_pallets : 1;
                    return (
                      <div key={r.shift_code} className="flex justify-between gap-1" title={`${t(`sh_${r.shift_code}` as TKey)}: ${r.used}/${r.max_pallets} ${t("used")}`}>
                        <span className="text-muted-foreground">{t(`sh_${r.shift_code}` as TKey).slice(0, 1)}</span>
                        <span className={pct >= 1 ? "font-semibold text-destructive" : pct >= 0.8 ? "font-semibold text-warning-foreground" : ""}>{r.used}/{r.max_pallets}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
