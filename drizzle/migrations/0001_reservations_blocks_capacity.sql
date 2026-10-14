CREATE TABLE public.docks (
  id int PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.docks TO authenticated;
GRANT ALL ON public.docks TO service_role;
ALTER TABLE public.docks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docks readable" ON public.docks FOR SELECT TO authenticated USING (true);
INSERT INTO public.docks (id, name) VALUES (1,'Muelle 1'),(2,'Muelle 2'),(3,'Muelle 3'),(4,'Muelle 4'),(5,'Muelle 5');

CREATE TABLE public.shifts (
  code text PRIMARY KEY,
  sort int NOT NULL,
  start_min int NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min int NOT NULL CHECK (end_min BETWEEN 0 AND 1439),
  default_max_pallets int NOT NULL CHECK (default_max_pallets >= 0)
);
GRANT SELECT ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts readable" ON public.shifts FOR SELECT TO authenticated USING (true);
INSERT INTO public.shifts VALUES ('morning',1,360,840,250),('afternoon',2,840,1320,150),('night',3,1320,360,100);

CREATE TABLE public.shift_capacity_overrides (
  service_date date NOT NULL,
  shift_code text NOT NULL REFERENCES public.shifts(code),
  max_pallets int NOT NULL CHECK (max_pallets >= 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_date, shift_code)
);
GRANT SELECT ON public.shift_capacity_overrides TO authenticated;
GRANT ALL ON public.shift_capacity_overrides TO service_role;
ALTER TABLE public.shift_capacity_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides readable" ON public.shift_capacity_overrides FOR SELECT TO authenticated USING (true);

CREATE TABLE public.holidays (
  day date PRIMARY KEY,
  name text NOT NULL,
  is_open boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays readable" ON public.holidays FOR SELECT TO authenticated USING (true);
INSERT INTO public.holidays (day, name) VALUES
('2026-01-01','Año Nuevo'),('2026-01-06','Epifanía del Señor'),('2026-04-03','Viernes Santo'),('2026-05-01','Fiesta del Trabajo'),
('2026-08-15','Asunción de la Virgen'),('2026-10-12','Fiesta Nacional de España'),('2026-11-01','Todos los Santos'),
('2026-12-06','Día de la Constitución'),('2026-12-08','Inmaculada Concepción'),('2026-12-25','Natividad del Señor'),
('2027-01-01','Año Nuevo'),('2027-01-06','Epifanía del Señor'),('2027-03-26','Viernes Santo'),('2027-05-01','Fiesta del Trabajo'),
('2027-08-15','Asunción de la Virgen'),('2027-10-12','Fiesta Nacional de España'),('2027-11-01','Todos los Santos'),
('2027-12-06','Día de la Constitución'),('2027-12-08','Inmaculada Concepción'),('2027-12-25','Natividad del Señor');

CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dock_id int REFERENCES public.docks(id),
  kind text NOT NULL CHECK (kind IN ('technical','organizational')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly')),
  recurrence_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks for managers" ON public.blocks FOR SELECT TO authenticated USING (public.is_staff_manager(auth.uid()));

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('R-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  total_pallets int NOT NULL CHECK (total_pallets BETWEEN 1 AND 66),
  service_date date,
  shift_code text,
  driver_name text NOT NULL,
  driver_doc text,
  tractor_plate text NOT NULL,
  trailer_plate text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','on_site','unloading','unloaded','dock_released','departed','no_show','cancelled')),
  rescheduled boolean NOT NULL DEFAULT false,
  cancel_reason text,
  qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  qr_valid boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX reservations_time_idx ON public.reservations (starts_at, ends_at);
GRANT SELECT ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations managers or own company" ON public.reservations FOR SELECT TO authenticated
USING (public.is_staff_manager(auth.uid()) OR company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active'));

CREATE TABLE public.reservation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  order_number text NOT NULL CHECK (order_number ~ '^4500[0-9]{6}$'),
  supplier text NOT NULL,
  pallets int NOT NULL CHECK (pallets BETWEEN 1 AND 66),
  UNIQUE (reservation_id, order_number)
);
GRANT SELECT ON public.reservation_orders TO authenticated;
GRANT ALL ON public.reservation_orders TO service_role;
ALTER TABLE public.reservation_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders follow reservation" ON public.reservation_orders FOR SELECT TO authenticated
USING (reservation_id IN (SELECT id FROM public.reservations));

CREATE TABLE public.reservation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reservation_audit TO authenticated;
GRANT ALL ON public.reservation_audit TO service_role;
ALTER TABLE public.reservation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit for managers" ON public.reservation_audit FOR SELECT TO authenticated USING (public.is_staff_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.pallets_duration_min(_pallets int) RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _pallets BETWEEN 1 AND 15 THEN 30 WHEN _pallets BETWEEN 16 AND 19 THEN 45
              WHEN _pallets BETWEEN 20 AND 33 THEN 60 WHEN _pallets BETWEEN 34 AND 66 THEN 120 ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.shift_at(_t timestamptz, OUT shift_code text, OUT service_date date)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE lt timestamp := _t AT TIME ZONE 'Europe/Madrid'; m int; s record;
BEGIN
  m := extract(hour FROM lt)::int * 60 + extract(minute FROM lt)::int;
  FOR s IN SELECT * FROM public.shifts ORDER BY sort LOOP
    IF s.start_min < s.end_min AND m >= s.start_min AND m < s.end_min THEN
      shift_code := s.code; service_date := lt::date; RETURN;
    ELSIF s.start_min > s.end_min AND m >= s.start_min THEN
      shift_code := s.code; service_date := lt::date; RETURN;
    ELSIF s.start_min > s.end_min AND m < s.end_min THEN
      shift_code := s.code; service_date := lt::date - 1; RETURN;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.shift_max_pallets(_code text, _date date) RETURNS int
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce((SELECT max_pallets FROM public.shift_capacity_overrides WHERE shift_code = _code AND service_date = _date),
                  (SELECT default_max_pallets FROM public.shifts WHERE code = _code))
$$;

CREATE OR REPLACE FUNCTION public.reservations_set_shift() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    SELECT * INTO r FROM public.shift_at(NEW.ends_at - interval '1 minute');
    NEW.shift_code := r.shift_code; NEW.service_date := r.service_date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER reservations_set_shift BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.reservations_set_shift();

CREATE OR REPLACE FUNCTION public.block_hits(_b public.blocks, _s timestamptz, _e timestamptz) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE step int; base int; k int; ls timestamp; le timestamp; os timestamptz; oe timestamptz;
BEGIN
  IF _b.recurrence = 'none' THEN RETURN _b.starts_at < _e AND _b.ends_at > _s; END IF;
  step := CASE _b.recurrence WHEN 'daily' THEN 1 ELSE 7 END;
  ls := _b.starts_at AT TIME ZONE 'Europe/Madrid';
  le := _b.ends_at AT TIME ZONE 'Europe/Madrid';
  base := floor((((_s AT TIME ZONE 'Europe/Madrid')::date - ls::date))::numeric / step)::int;
  FOR k IN SELECT generate_series((base - 1) * step, (base + 1) * step, step) LOOP
    CONTINUE WHEN k < 0;
    CONTINUE WHEN _b.recurrence_until IS NOT NULL AND ls::date + k > _b.recurrence_until;
    os := (ls + k * interval '1 day') AT TIME ZONE 'Europe/Madrid';
    oe := (le + k * interval '1 day') AT TIME ZONE 'Europe/Madrid';
    IF os < _e AND oe > _s THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.is_active_status(_s text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$ SELECT _s NOT IN ('cancelled','no_show') $$;

CREATE OR REPLACE FUNCTION public.check_capacity(_start timestamptz, _end timestamptz, _pallets int, _exclude uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE slot timestamptz; busy int; free int; sh record; used int; mx int; hol record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('logidex_capacity'));
  IF extract(minute FROM _start)::int % 15 <> 0 OR extract(second FROM _start) <> 0 THEN RAISE EXCEPTION 'ERR_SLOT'; END IF;
  FOR slot IN SELECT generate_series(_start, _end - interval '15 minutes', interval '15 minutes') LOOP
    SELECT * INTO hol FROM public.holidays WHERE day = (slot AT TIME ZONE 'Europe/Madrid')::date;
    IF FOUND AND NOT hol.is_open THEN RAISE EXCEPTION 'ERR_HOLIDAY'; END IF;
    IF EXISTS (SELECT 1 FROM public.blocks b WHERE b.dock_id IS NULL AND public.block_hits(b, slot, slot + interval '15 minutes')) THEN
      RAISE EXCEPTION 'ERR_BLOCKED';
    END IF;
    SELECT count(*) INTO busy FROM public.reservations r
      WHERE public.is_active_status(r.status) AND r.id IS DISTINCT FROM _exclude
        AND r.starts_at < slot + interval '15 minutes' AND r.ends_at > slot;
    IF busy >= 2 THEN RAISE EXCEPTION 'ERR_SIMULTANEOUS'; END IF;
    SELECT count(*) INTO free FROM public.docks d WHERE d.active
      AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE b.dock_id = d.id AND public.block_hits(b, slot, slot + interval '15 minutes'));
    IF free <= busy THEN RAISE EXCEPTION 'ERR_NO_DOCK'; END IF;
  END LOOP;
  SELECT * INTO sh FROM public.shift_at(_end - interval '1 minute');
  mx := public.shift_max_pallets(sh.shift_code, sh.service_date);
  SELECT coalesce(sum(total_pallets),0) INTO used FROM public.reservations r
    WHERE public.is_active_status(r.status) AND r.id IS DISTINCT FROM _exclude
      AND r.shift_code = sh.shift_code AND r.service_date = sh.service_date;
  IF used + _pallets > mx THEN RAISE EXCEPTION 'ERR_SHIFT_FULL'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_capacity(timestamptz, timestamptz, int, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_reservation(
  _id uuid, _date date, _time text, _orders jsonb,
  _driver_name text, _driver_doc text, _tractor_plate text, _trailer_plate text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old public.reservations; new_start timestamptz; new_end timestamptz; total int; n int; nsup int; ndist int;
        o jsonb; changes jsonb := '{}'::jsonb; old_orders jsonb; time_changed boolean; driver_changed boolean;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO old FROM public.reservations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF old.status <> 'confirmed' THEN RAISE EXCEPTION 'ERR_NOT_EDITABLE'; END IF;
  IF coalesce(trim(_driver_name),'') = '' OR coalesce(trim(_tractor_plate),'') = '' THEN RAISE EXCEPTION 'ERR_REQUIRED'; END IF;
  n := jsonb_array_length(_orders);
  IF n < 1 OR n > 6 THEN RAISE EXCEPTION 'ERR_ORDERS_COUNT'; END IF;
  FOR o IN SELECT * FROM jsonb_array_elements(_orders) LOOP
    IF NOT (o->>'order_number') ~ '^4500[0-9]{6}$' THEN RAISE EXCEPTION 'ERR_ORDER_FORMAT'; END IF;
    IF coalesce(trim(o->>'supplier'),'') = '' THEN RAISE EXCEPTION 'ERR_REQUIRED'; END IF;
    IF (o->>'pallets')::int NOT BETWEEN 1 AND 66 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
  END LOOP;
  SELECT count(DISTINCT x->>'order_number'), count(DISTINCT lower(trim(x->>'supplier'))), sum((x->>'pallets')::int)
    INTO ndist, nsup, total FROM jsonb_array_elements(_orders) x;
  IF ndist <> n THEN RAISE EXCEPTION 'ERR_ORDER_DUP'; END IF;
  IF nsup > 6 THEN RAISE EXCEPTION 'ERR_SUPPLIERS'; END IF;
  IF total > 66 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
  IF _time !~ '^([01][0-9]|2[0-3]):(00|15|30|45)$' THEN RAISE EXCEPTION 'ERR_SLOT'; END IF;
  new_start := (_date + _time::time) AT TIME ZONE 'Europe/Madrid';
  new_end := new_start + make_interval(mins => public.pallets_duration_min(total));
  PERFORM public.check_capacity(new_start, new_end, total, _id);

  time_changed := new_start <> old.starts_at;
  driver_changed := trim(_driver_name) <> old.driver_name OR coalesce(trim(_driver_doc),'') <> coalesce(old.driver_doc,'');
  SELECT coalesce(jsonb_agg(jsonb_build_object('order_number',order_number,'supplier',supplier,'pallets',pallets) ORDER BY order_number),'[]')
    INTO old_orders FROM public.reservation_orders WHERE reservation_id = _id;
  IF time_changed THEN changes := changes || jsonb_build_object('starts_at', jsonb_build_array(old.starts_at, new_start)); END IF;
  IF total <> old.total_pallets THEN changes := changes || jsonb_build_object('total_pallets', jsonb_build_array(old.total_pallets, total)); END IF;
  IF old_orders <> (SELECT jsonb_agg(jsonb_build_object('order_number',x->>'order_number','supplier',trim(x->>'supplier'),'pallets',(x->>'pallets')::int) ORDER BY x->>'order_number') FROM jsonb_array_elements(_orders) x) THEN
    changes := changes || jsonb_build_object('orders', jsonb_build_array(old_orders, _orders)); END IF;
  IF trim(_driver_name) <> old.driver_name THEN changes := changes || jsonb_build_object('driver_name', jsonb_build_array(old.driver_name, trim(_driver_name))); END IF;
  IF coalesce(trim(_driver_doc),'') <> coalesce(old.driver_doc,'') THEN changes := changes || jsonb_build_object('driver_doc', jsonb_build_array(old.driver_doc, nullif(trim(_driver_doc),''))); END IF;
  IF upper(trim(_tractor_plate)) <> old.tractor_plate THEN changes := changes || jsonb_build_object('tractor_plate', jsonb_build_array(old.tractor_plate, upper(trim(_tractor_plate)))); END IF;
  IF coalesce(upper(trim(_trailer_plate)),'') <> coalesce(old.trailer_plate,'') THEN changes := changes || jsonb_build_object('trailer_plate', jsonb_build_array(old.trailer_plate, nullif(upper(trim(_trailer_plate)),''))); END IF;
  IF changes = '{}'::jsonb THEN RETURN; END IF;
  IF time_changed OR driver_changed THEN changes := changes || jsonb_build_object('qr_reissued', true); END IF;

  UPDATE public.reservations SET
    starts_at = new_start, ends_at = new_end, total_pallets = total,
    driver_name = trim(_driver_name), driver_doc = nullif(trim(_driver_doc),''),
    tractor_plate = upper(trim(_tractor_plate)), trailer_plate = nullif(upper(trim(_trailer_plate)),''),
    rescheduled = rescheduled OR time_changed,
    qr_token = CASE WHEN time_changed OR driver_changed THEN gen_random_uuid() ELSE qr_token END
  WHERE id = _id;
  DELETE FROM public.reservation_orders WHERE reservation_id = _id;
  INSERT INTO public.reservation_orders (reservation_id, order_number, supplier, pallets)
    SELECT _id, x->>'order_number', trim(x->>'supplier'), (x->>'pallets')::int FROM jsonb_array_elements(_orders) x;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes) VALUES (_id, auth.uid(), 'update', changes);
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_reservation(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old public.reservations;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'ERR_REASON'; END IF;
  SELECT * INTO old FROM public.reservations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF old.status <> 'confirmed' THEN RAISE EXCEPTION 'ERR_NOT_EDITABLE'; END IF;
  UPDATE public.reservations SET status = 'cancelled', cancel_reason = trim(_reason), qr_valid = false WHERE id = _id;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes)
    VALUES (_id, auth.uid(), 'cancel', jsonb_build_object('reason', trim(_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.block_affected(_dock int, _start timestamptz, _end timestamptz, _recurrence text, _until date)
RETURNS TABLE (id uuid, code text, starts_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.blocks;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  b.dock_id := _dock; b.starts_at := _start; b.ends_at := _end; b.recurrence := _recurrence; b.recurrence_until := _until;
  RETURN QUERY SELECT r.id, r.code, r.starts_at FROM public.reservations r
    WHERE public.is_active_status(r.status) AND r.ends_at > now() AND public.block_hits(b, r.starts_at, r.ends_at)
    ORDER BY r.starts_at LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_block(_id uuid, _dock int, _kind text, _start timestamptz, _end timestamptz,
  _reason text, _recurrence text, _until date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'ERR_REASON'; END IF;
  IF _end <= _start THEN RAISE EXCEPTION 'ERR_RANGE'; END IF;
  IF extract(minute FROM _start)::int % 15 <> 0 OR extract(minute FROM _end)::int % 15 <> 0 THEN RAISE EXCEPTION 'ERR_SLOT'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.blocks (dock_id, kind, starts_at, ends_at, reason, recurrence, recurrence_until, created_by)
    VALUES (_dock, _kind, _start, _end, trim(_reason), _recurrence, _until, auth.uid()) RETURNING id INTO rid;
  ELSE
    UPDATE public.blocks SET dock_id = _dock, kind = _kind, starts_at = _start, ends_at = _end, reason = trim(_reason),
      recurrence = _recurrence, recurrence_until = _until WHERE id = _id RETURNING id INTO rid;
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_block(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.blocks WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_shift_default(_code text, _max int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _max < 0 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
  UPDATE public.shifts SET default_max_pallets = _max WHERE code = _code;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_capacity_override(_date date, _code text, _max int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _max IS NULL THEN
    DELETE FROM public.shift_capacity_overrides WHERE service_date = _date AND shift_code = _code;
  ELSE
    IF _max < 0 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
    INSERT INTO public.shift_capacity_overrides (service_date, shift_code, max_pallets, updated_by)
    VALUES (_date, _code, _max, auth.uid())
    ON CONFLICT (service_date, shift_code) DO UPDATE SET max_pallets = EXCLUDED.max_pallets, updated_by = auth.uid(), updated_at = now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_holiday_open(_day date, _open boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.holidays SET is_open = _open, updated_by = auth.uid(), updated_at = now() WHERE day = _day;
END $$;

CREATE OR REPLACE FUNCTION public.calendar_summary(_from date, _to date)
RETURNS TABLE (day date, shift_code text, used int, max_pallets int, holiday_name text, holiday_open boolean, blocks int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff_manager(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT d::date, s.code,
    (SELECT coalesce(sum(r.total_pallets),0)::int FROM public.reservations r
       WHERE public.is_active_status(r.status) AND r.service_date = d::date AND r.shift_code = s.code),
    public.shift_max_pallets(s.code, d::date),
    h.name, h.is_open,
    (SELECT count(*)::int FROM public.blocks b WHERE public.block_hits(b,
        (d::date + time '00:00') AT TIME ZONE 'Europe/Madrid', (d::date + 1 + time '00:00') AT TIME ZONE 'Europe/Madrid'))
  FROM generate_series(_from, _to, interval '1 day') d
  CROSS JOIN public.shifts s
  LEFT JOIN public.holidays h ON h.day = d::date
  ORDER BY d, s.sort;
END $$;

INSERT INTO public.companies (id, name, tax_id, phone, status) VALUES
('00000000-0000-4000-8000-000000000001','Transportes Demo SL','B00000001','600 000 001','approved'),
('00000000-0000-4000-8000-000000000002','Logística Ejemplo SA','A00000002','600 000 002','approved')
ON CONFLICT DO NOTHING;

INSERT INTO public.reservations (id, code, company_id, starts_at, ends_at, total_pallets, driver_name, driver_doc, tractor_plate, trailer_plate) VALUES
('00000000-0000-4000-9000-000000000001','R-DEMO01','00000000-0000-4000-8000-000000000001',('2026-10-15 08:00'::timestamp AT TIME ZONE 'Europe/Madrid'),('2026-10-15 09:00'::timestamp AT TIME ZONE 'Europe/Madrid'),24,'Jordi Puig','12345678Z','1234 KLM','R-5678-BCD'),
('00000000-0000-4000-9000-000000000002','R-DEMO02','00000000-0000-4000-8000-000000000002',('2026-10-15 08:30'::timestamp AT TIME ZONE 'Europe/Madrid'),('2026-10-15 09:00'::timestamp AT TIME ZONE 'Europe/Madrid'),12,'Ana López','87654321X','5678 BCD',NULL),
('00000000-0000-4000-9000-000000000003','R-DEMO03','00000000-0000-4000-8000-000000000001',('2026-10-15 15:00'::timestamp AT TIME ZONE 'Europe/Madrid'),('2026-10-15 17:00'::timestamp AT TIME ZONE 'Europe/Madrid'),40,'Marc Soler','11223344B','9012 FGH','R-1122-JKL'),
('00000000-0000-4000-9000-000000000004','R-DEMO04','00000000-0000-4000-8000-000000000002',('2026-10-16 10:00'::timestamp AT TIME ZONE 'Europe/Madrid'),('2026-10-16 10:45'::timestamp AT TIME ZONE 'Europe/Madrid'),18,'Laura Martí','55667788C','3456 MNP',NULL),
('00000000-0000-4000-9000-000000000005','R-DEMO05','00000000-0000-4000-8000-000000000001',('2026-10-16 23:00'::timestamp AT TIME ZONE 'Europe/Madrid'),('2026-10-17 00:00'::timestamp AT TIME ZONE 'Europe/Madrid'),30,'Pere Vidal','99887766D','7890 RST','R-3344-VWX'),
('00000000-0000-4000-9000-000000000006','R-DEMO06','00000000-0000-4000-8000-000000000002',('2026-10-19 07:00'::timestamp AT TIME ZONE 'Europe/Madrid'),('2026-10-19 07:30'::timestamp AT TIME ZONE 'Europe/Madrid'),8,'Carmen Ruiz','44332211E','2468 XYZ',NULL);

INSERT INTO public.reservation_orders (reservation_id, order_number, supplier, pallets) VALUES
('00000000-0000-4000-9000-000000000001','4500100001','Proveedor Norte',14),
('00000000-0000-4000-9000-000000000001','4500100002','Proveedor Sur',10),
('00000000-0000-4000-9000-000000000002','4500100003','Proveedor Norte',12),
('00000000-0000-4000-9000-000000000003','4500100004','Frutas Levante',20),
('00000000-0000-4000-9000-000000000003','4500100005','Lácteos Pirineo',20),
('00000000-0000-4000-9000-000000000004','4500100006','Proveedor Sur',18),
('00000000-0000-4000-9000-000000000005','4500100007','Bebidas Mediterráneo',30),
('00000000-0000-4000-9000-000000000006','4500100008','Proveedor Norte',8);