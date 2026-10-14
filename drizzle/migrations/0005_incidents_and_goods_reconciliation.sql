ALTER TABLE public.reservation_orders
  ADD COLUMN pallets_presented integer,
  ADD COLUMN pallets_accepted integer,
  ADD COLUMN pallets_rejected integer,
  ADD COLUMN pallets_missing integer,
  ADD COLUMN reconciliation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN reject_reason text,
  ADD COLUMN reject_destination text;

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.reservation_orders(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('delay','damaged','wet','return','difference','other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  description text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz
);
GRANT SELECT ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents for managers" ON public.incidents FOR SELECT TO authenticated USING (public.is_staff_manager(auth.uid()));
CREATE INDEX incidents_reservation_idx ON public.incidents(reservation_id);

CREATE OR REPLACE FUNCTION public.staff_create_incident(_reservation uuid, _order uuid, _type text, _severity text, _description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(btrim(_description),'') = '' THEN RAISE EXCEPTION 'ERR_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM reservations WHERE id = _reservation) THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF _order IS NOT NULL AND NOT EXISTS (SELECT 1 FROM reservation_orders WHERE id = _order AND reservation_id = _reservation) THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  INSERT INTO incidents (reservation_id, order_id, type, severity, description, created_by)
  VALUES (_reservation, _order, _type, _severity, btrim(_description), auth.uid()) RETURNING id INTO _id;
  INSERT INTO reservation_audit (reservation_id, actor_id, action, changes)
  VALUES (_reservation, auth.uid(), 'incident', jsonb_build_object('type', _type, 'severity', _severity));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.staff_set_incident_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _res uuid;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('open','resolved') THEN RAISE EXCEPTION 'ERR_UNKNOWN'; END IF;
  UPDATE incidents SET status = _status,
    resolved_by = CASE WHEN _status='resolved' THEN auth.uid() END,
    resolved_at = CASE WHEN _status='resolved' THEN now() END
  WHERE id = _id RETURNING reservation_id INTO _res;
  IF _res IS NULL THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  INSERT INTO reservation_audit (reservation_id, actor_id, action, changes)
  VALUES (_res, auth.uid(), 'incident_' || _status, '{}'::jsonb);
END $$;

-- Goods reconciliation per order. Missing is never inferred; status 'pending' allowed.
CREATE OR REPLACE FUNCTION public.staff_reconcile_order(_order uuid, _presented integer, _accepted integer, _rejected integer, _missing integer, _reason text, _destination text, _complete boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o reservation_orders; st text;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO o FROM reservation_orders WHERE id = _order FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  SELECT status INTO st FROM reservations WHERE id = o.reservation_id;
  IF st NOT IN ('on_site','unloading','unloaded','dock_released','departed') THEN RAISE EXCEPTION 'ERR_NOT_ARRIVED'; END IF;
  IF least(coalesce(_presented,0), coalesce(_accepted,0), coalesce(_rejected,0), coalesce(_missing,0)) < 0 THEN RAISE EXCEPTION 'ERR_GOODS_NEGATIVE'; END IF;
  IF _presented IS NOT NULL AND coalesce(_accepted,0) + coalesce(_rejected,0) > _presented THEN RAISE EXCEPTION 'ERR_GOODS_OVER_PRESENTED'; END IF;
  IF coalesce(_rejected,0) > 0 AND coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'ERR_REJECT_REASON'; END IF;
  IF _complete THEN
    IF _presented IS NULL OR _accepted IS NULL OR _rejected IS NULL OR _missing IS NULL THEN RAISE EXCEPTION 'ERR_GOODS_INCOMPLETE'; END IF;
    IF _accepted + _rejected <> _presented THEN RAISE EXCEPTION 'ERR_GOODS_SUM'; END IF;
  END IF;
  UPDATE reservation_orders SET pallets_presented=_presented, pallets_accepted=_accepted, pallets_rejected=_rejected,
    pallets_missing=_missing, reject_reason=nullif(btrim(_reason),''), reject_destination=nullif(btrim(_destination),''),
    reconciliation_status = CASE WHEN _complete THEN 'done' ELSE 'pending' END
  WHERE id = _order;
  INSERT INTO reservation_audit (reservation_id, actor_id, action, changes)
  VALUES (o.reservation_id, auth.uid(), 'reconcile', jsonb_build_object('order', o.order_number, 'presented', _presented, 'accepted', _accepted, 'rejected', _rejected, 'missing', _missing, 'done', _complete));
END $$;

REVOKE EXECUTE ON FUNCTION public.staff_create_incident(uuid,uuid,text,text,text), public.staff_set_incident_status(uuid,text), public.staff_reconcile_order(uuid,integer,integer,integer,integer,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_create_incident(uuid,uuid,text,text,text), public.staff_set_incident_status(uuid,text), public.staff_reconcile_order(uuid,integer,integer,integer,integer,text,text,boolean) TO authenticated;

CREATE POLICY "incident files staff read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'incident-files' AND public.is_staff_manager(auth.uid()));
CREATE POLICY "incident files staff upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'incident-files' AND public.is_staff_manager(auth.uid()));