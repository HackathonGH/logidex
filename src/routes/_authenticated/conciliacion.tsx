import { createFileRoute } from "@tanstack/react-router";
import { StaffPage } from "@/components/StaffPage";
import { DayDeliveries } from "@/components/DayDeliveries";
import { GoodsPanel } from "@/components/GoodsIncidents";

const ARRIVED = ["on_site", "unloading", "unloaded", "dock_released", "departed"];

export const Route = createFileRoute("/_authenticated/conciliacion")({
  head: () => ({ meta: [{ title: "Conciliación de mercancía — LOGIDEX" }, { name: "description", content: "Recuento de palets por pedido de cada entrega" }] }),
  component: () => (
    <StaffPage title="menu_reconcile">
      {() => <DayDeliveries filter={(r) => ARRIVED.includes(r.status)}>{(r) => <GoodsPanel reservationId={r.id} status={r.status} />}</DayDeliveries>}
    </StaffPage>
  ),
});
