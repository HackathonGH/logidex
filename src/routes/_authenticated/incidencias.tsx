import { createFileRoute } from "@tanstack/react-router";
import { StaffPage } from "@/components/StaffPage";
import { DayDeliveries } from "@/components/DayDeliveries";
import { IncidentsPanel } from "@/components/GoodsIncidents";

export const Route = createFileRoute("/_authenticated/incidencias")({
  head: () => ({ meta: [{ title: "Incidencias — LOGIDEX" }, { name: "description", content: "Registro y seguimiento de incidencias por entrega" }] }),
  component: () => <StaffPage title="menu_incidents">{() => <DayDeliveries>{(r) => <IncidentsPanel reservationId={r.id} />}</DayDeliveries>}</StaffPage>,
});
