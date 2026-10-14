import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

export function StatusBadges({ status, rescheduled }: { status: string; rescheduled: boolean }) {
  const { t } = useI18n();
  const cancelled = status === "cancelled" || status === "no_show";
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className={cancelled ? "border-destructive/40 text-destructive" : status === "confirmed" ? "border-success/40 text-success" : ""}>
        {cancelled ? <XCircle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
        {t(`rs_${status}` as TKey)}
      </Badge>
      {rescheduled && !cancelled && (
        <Badge variant="outline" className="border-warning/50 text-warning-foreground bg-warning/20">
          <CalendarClock className="mr-1 h-3 w-3" />{t("rescheduled")}
        </Badge>
      )}
    </div>
  );
}
