ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS delay_alerted_at timestamptz;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('delay','late_cancel','incident')),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text,
  resolved_by uuid
);
CREATE UNIQUE INDEX notifications_one_open_delay ON public.notifications (reservation_id) WHERE kind = 'delay' AND resolved_at IS NULL;
CREATE INDEX notifications_created ON public.notifications (created_at DESC);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read notifications" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_staff_manager(auth.uid()) AND (kind <> 'late_cancel' OR public.has_role(auth.uid(), 'admin')));

CREATE TABLE public.notification_reads (
  user_id uuid NOT NULL,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);
GRANT SELECT, INSERT ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads select" ON public.notification_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own reads insert" ON public.notification_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- +15 min without arrival: one alert per reservation (deduplicated), never changes status.
-- Called by open staff screens every minute (no background job).
CREATE OR REPLACE FUNCTION public.staff_detect_delays() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH due AS (
    UPDATE public.reservations SET delay_alerted_at = now()
    WHERE status = 'confirmed' AND arrived_at IS NULL AND delay_alerted_at IS NULL AND starts_at + interval '15 minutes' <= now()
    RETURNING id)
  INSERT INTO public.notifications (kind, reservation_id) SELECT 'delay', id FROM due ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.trg_reservation_notifications() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status AND OLD.status = 'confirmed' THEN
    UPDATE public.notifications SET resolved_at = now(), resolution = NEW.status, resolved_by = auth.uid()
      WHERE reservation_id = NEW.id AND kind = 'delay' AND resolved_at IS NULL;
  END IF;
  IF NEW.starts_at <> OLD.starts_at THEN
    UPDATE public.notifications SET resolved_at = now(), resolution = 'rescheduled', resolved_by = auth.uid()
      WHERE reservation_id = NEW.id AND kind = 'delay' AND resolved_at IS NULL;
    NEW.delay_alerted_at := NULL;
  END IF;
  IF NEW.penalty AND NOT coalesce(OLD.penalty, false) THEN
    INSERT INTO public.notifications (kind, reservation_id) VALUES ('late_cancel', NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reservation_notifications BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.trg_reservation_notifications();

CREATE OR REPLACE FUNCTION public.trg_incident_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (kind, reservation_id, incident_id) VALUES ('incident', NEW.reservation_id, NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER incident_notification AFTER INSERT ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.trg_incident_notification();

CREATE OR REPLACE FUNCTION public.staff_keep_delayed(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.notifications SET resolved_at = now(), resolution = 'kept', resolved_by = auth.uid()
    WHERE reservation_id = _id AND kind = 'delay' AND resolved_at IS NULL;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes) VALUES (_id, auth.uid(), 'delay_kept', '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.staff_available_slots(_id uuid, _date date) RETURNS SETOF text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i int; st timestamptz; en timestamptz; r public.reservations; dur int;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.reservations WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  dur := public.pallets_duration_min(r.total_pallets);
  FOR i IN 0..95 LOOP
    st := (_date + make_interval(mins => i * 15)) AT TIME ZONE 'Europe/Madrid';
    CONTINUE WHEN st < now();
    en := st + make_interval(mins => dur);
    BEGIN
      PERFORM public.check_capacity(st, en, r.total_pallets, _id);
      RETURN NEXT to_char(make_interval(mins => i * 15), 'HH24:MI');
    EXCEPTION WHEN raise_exception THEN NULL;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.staff_reschedule(_id uuid, _date date, _time text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reservations; ords jsonb;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.reservations WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  SELECT jsonb_agg(jsonb_build_object('order_number', order_number, 'supplier', supplier, 'pallets', pallets)) INTO ords
    FROM public.reservation_orders WHERE reservation_id = _id;
  PERFORM public.admin_update_reservation(_id, _date, _time, ords, r.driver_name, r.driver_doc, r.tractor_plate, r.trailer_plate);
END $$;

REVOKE ALL ON FUNCTION public.staff_detect_delays(), public.staff_keep_delayed(uuid), public.staff_available_slots(uuid, date), public.staff_reschedule(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_detect_delays(), public.staff_keep_delayed(uuid), public.staff_available_slots(uuid, date), public.staff_reschedule(uuid, date, text) TO authenticated;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;