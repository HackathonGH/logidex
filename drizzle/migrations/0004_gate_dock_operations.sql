ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS dock_id int REFERENCES public.docks(id),
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS unload_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS unload_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS dock_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS departed_at timestamptz;

CREATE OR REPLACE FUNCTION public.can_gate(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff_manager(_user_id) OR public.has_role(_user_id, 'control_accesos')
$$;

-- Gate: look up a QR. Returns only what is needed to check identity at the barrier.
CREATE OR REPLACE FUNCTION public.gate_lookup(_token uuid)
RETURNS TABLE (id uuid, code text, company text, starts_at timestamptz, ends_at timestamptz, driver_name text, driver_doc text,
  tractor_plate text, trailer_plate text, status text, valid boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_gate(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT r.id, r.code, c.name, r.starts_at, r.ends_at, r.driver_name, r.driver_doc, r.tractor_plate, r.trailer_plate, r.status,
    (r.qr_valid AND r.status = 'confirmed')
  FROM public.reservations r JOIN public.companies c ON c.id = r.company_id WHERE r.qr_token = _token;
END $$;

CREATE OR REPLACE FUNCTION public.gate_register_arrival(_token uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reservations;
BEGIN
  IF NOT public.can_gate(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.reservations WHERE qr_token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_QR_UNKNOWN'; END IF;
  IF NOT r.qr_valid OR r.status <> 'confirmed' THEN RAISE EXCEPTION 'ERR_QR_INVALID'; END IF;
  UPDATE public.reservations SET status = 'on_site', arrived_at = now() WHERE id = r.id;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes) VALUES (r.id, auth.uid(), 'arrival', '{}'::jsonb);
  RETURN r.id;
END $$;

-- Docks free right now for a reservation: active, not blocked, not held by another truck.
CREATE OR REPLACE FUNCTION public.free_docks(_id uuid) RETURNS SETOF int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reservations; e timestamptz;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.reservations WHERE id = _id;
  e := now() + make_interval(mins => public.pallets_duration_min(r.total_pallets));
  RETURN QUERY SELECT d.id FROM public.docks d
   WHERE d.active
     AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.dock_id IS NULL OR b.dock_id = d.id) AND public.block_hits(b, now(), e))
     AND NOT EXISTS (SELECT 1 FROM public.reservations o WHERE o.id <> _id AND o.dock_id = d.id
                     AND o.status IN ('on_site','unloading','unloaded'))
   ORDER BY d.id;
END $$;

CREATE OR REPLACE FUNCTION public.staff_assign_dock(_id uuid, _dock int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reservations; busy int;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('logidex_docks'));
  SELECT * INTO r FROM public.reservations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF r.status NOT IN ('on_site','unloading') THEN RAISE EXCEPTION 'ERR_NOT_EDITABLE'; END IF;
  IF _dock NOT IN (SELECT public.free_docks(_id)) THEN RAISE EXCEPTION 'ERR_DOCK_BUSY'; END IF;
  SELECT count(*) INTO busy FROM public.reservations o WHERE o.id <> _id AND o.dock_id IS NOT NULL AND o.status IN ('on_site','unloading','unloaded');
  IF busy >= 2 THEN RAISE EXCEPTION 'ERR_SIMULTANEOUS'; END IF;
  UPDATE public.reservations SET dock_id = _dock WHERE id = _id;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes)
    VALUES (_id, auth.uid(), 'dock', jsonb_build_object('dock', jsonb_build_array(r.dock_id, _dock)));
END $$;

-- Operational cycle, strictly in order: start → end → release → depart; no_show only before arrival.
CREATE OR REPLACE FUNCTION public.staff_advance(_id uuid, _action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reservations;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.reservations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF _action = 'start' AND r.status = 'on_site' THEN
    IF r.dock_id IS NULL THEN RAISE EXCEPTION 'ERR_NO_DOCK_ASSIGNED'; END IF;
    UPDATE public.reservations SET status = 'unloading', unload_started_at = now() WHERE id = _id;
  ELSIF _action = 'end' AND r.status = 'unloading' THEN
    UPDATE public.reservations SET status = 'unloaded', unload_ended_at = now() WHERE id = _id;
  ELSIF _action = 'release' AND r.status = 'unloaded' THEN
    UPDATE public.reservations SET status = 'dock_released', dock_released_at = now() WHERE id = _id;
  ELSIF _action = 'depart' AND r.status = 'dock_released' THEN
    UPDATE public.reservations SET status = 'departed', departed_at = now() WHERE id = _id;
  ELSIF _action = 'no_show' AND r.status = 'confirmed' THEN
    UPDATE public.reservations SET status = 'no_show', qr_valid = false WHERE id = _id;
  ELSE
    RAISE EXCEPTION 'ERR_TRANSITION';
  END IF;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes) VALUES (_id, auth.uid(), _action, '{}'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.gate_lookup(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gate_register_arrival(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.free_docks(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_assign_dock(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_advance(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gate_lookup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gate_register_arrival(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.free_docks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_assign_dock(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_advance(uuid, text) TO authenticated;

ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;