CREATE OR REPLACE FUNCTION public.admin_set_shift_default(_code text, _max int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _max < 0 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
  UPDATE public.shifts SET default_max_pallets = _max WHERE code = _code;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_capacity_override(_date date, _code text, _max int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _max IS NULL THEN
    DELETE FROM public.shift_capacity_overrides WHERE service_date = _date AND shift_code = _code;
  ELSE
    IF _max < 0 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
    INSERT INTO public.shift_capacity_overrides (service_date, shift_code, max_pallets, updated_by)
    VALUES (_date, _code, _max, auth.uid())
    ON CONFLICT (service_date, shift_code) DO UPDATE SET max_pallets = EXCLUDED.max_pallets, updated_by = auth.uid(), updated_at = now();
  END IF;
END $$;

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS penalty boolean NOT NULL DEFAULT false;

-- Company of the calling carrier (active profile, carrier role, approved company), else error.
CREATE OR REPLACE FUNCTION public.carrier_company() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  SELECT p.company_id INTO cid FROM public.profiles p JOIN public.companies c ON c.id = p.company_id
   WHERE p.id = auth.uid() AND p.status = 'active' AND c.status = 'approved';
  IF cid IS NULL OR NOT public.has_role(auth.uid(), 'transportista') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.validate_orders_json(_orders jsonb) RETURNS int
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE n int; o jsonb; ndist int; nsup int; total int;
BEGIN
  n := jsonb_array_length(_orders);
  IF n < 1 OR n > 6 THEN RAISE EXCEPTION 'ERR_ORDERS_COUNT'; END IF;
  FOR o IN SELECT * FROM jsonb_array_elements(_orders) LOOP
    IF NOT coalesce(o->>'order_number','') ~ '^4500[0-9]{6}$' THEN RAISE EXCEPTION 'ERR_ORDER_FORMAT'; END IF;
    IF coalesce(trim(o->>'supplier'),'') = '' THEN RAISE EXCEPTION 'ERR_REQUIRED'; END IF;
    IF (o->>'pallets')::int NOT BETWEEN 1 AND 66 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
  END LOOP;
  SELECT count(DISTINCT x->>'order_number'), count(DISTINCT lower(trim(x->>'supplier'))), sum((x->>'pallets')::int)
    INTO ndist, nsup, total FROM jsonb_array_elements(_orders) x;
  IF ndist <> n THEN RAISE EXCEPTION 'ERR_ORDER_DUP'; END IF;
  IF nsup > 6 THEN RAISE EXCEPTION 'ERR_SUPPLIERS'; END IF;
  IF total > 66 THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
  RETURN total;
END $$;

-- Start times bookable by a carrier on a date for a pallet total (all capacity rules + 24h advance).
CREATE OR REPLACE FUNCTION public.carrier_available_slots(_date date, _pallets int) RETURNS SETOF text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i int; st timestamptz; en timestamptz; dur int;
BEGIN
  PERFORM public.carrier_company();
  dur := public.pallets_duration_min(_pallets);
  IF dur IS NULL THEN RAISE EXCEPTION 'ERR_PALLETS'; END IF;
  FOR i IN 0..95 LOOP
    st := (_date + make_interval(mins => i * 15)) AT TIME ZONE 'Europe/Madrid';
    CONTINUE WHEN st < now() + interval '24 hours';
    en := st + make_interval(mins => dur);
    BEGIN
      PERFORM public.check_capacity(st, en, _pallets, NULL);
      RETURN NEXT to_char(make_interval(mins => i * 15), 'HH24:MI');
    EXCEPTION WHEN raise_exception THEN NULL;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.carrier_create_reservation(
  _date date, _time text, _orders jsonb, _driver_name text, _driver_doc text, _tractor_plate text, _trailer_plate text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; total int; st timestamptz; en timestamptz; rid uuid; o jsonb;
BEGIN
  cid := public.carrier_company();
  IF coalesce(trim(_driver_name),'') = '' OR coalesce(trim(_driver_doc),'') = '' OR coalesce(trim(_tractor_plate),'') = '' THEN RAISE EXCEPTION 'ERR_REQUIRED'; END IF;
  total := public.validate_orders_json(_orders);
  IF _time !~ '^([01][0-9]|2[0-3]):(00|15|30|45)$' THEN RAISE EXCEPTION 'ERR_SLOT'; END IF;
  st := (_date + _time::time) AT TIME ZONE 'Europe/Madrid';
  IF st < now() + interval '24 hours' THEN RAISE EXCEPTION 'ERR_ADVANCE'; END IF;
  en := st + make_interval(mins => public.pallets_duration_min(total));
  PERFORM public.check_capacity(st, en, total, NULL);
  INSERT INTO public.reservations (company_id, starts_at, ends_at, total_pallets, driver_name, driver_doc, tractor_plate, trailer_plate, created_by)
  VALUES (cid, st, en, total, trim(_driver_name), trim(_driver_doc), upper(trim(_tractor_plate)), nullif(upper(trim(coalesce(_trailer_plate,''))),''), auth.uid())
  RETURNING id INTO rid;
  FOR o IN SELECT * FROM jsonb_array_elements(_orders) LOOP
    INSERT INTO public.reservation_orders (reservation_id, order_number, supplier, pallets)
    VALUES (rid, o->>'order_number', trim(o->>'supplier'), (o->>'pallets')::int);
  END LOOP;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes)
    VALUES (rid, auth.uid(), 'create', jsonb_build_object('starts_at', st, 'total_pallets', total));
  RETURN rid;
END $$;

-- Driver/plates change until arrival; driver change reissues the QR.
CREATE OR REPLACE FUNCTION public.carrier_update_driver(_id uuid, _driver_name text, _driver_doc text, _tractor_plate text, _trailer_plate text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; old public.reservations; changes jsonb := '{}'::jsonb; drv boolean;
BEGIN
  cid := public.carrier_company();
  SELECT * INTO old FROM public.reservations WHERE id = _id AND company_id = cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF old.status <> 'confirmed' THEN RAISE EXCEPTION 'ERR_NOT_EDITABLE'; END IF;
  IF coalesce(trim(_driver_name),'') = '' OR coalesce(trim(_driver_doc),'') = '' OR coalesce(trim(_tractor_plate),'') = '' THEN RAISE EXCEPTION 'ERR_REQUIRED'; END IF;
  drv := trim(_driver_name) <> old.driver_name OR trim(_driver_doc) <> coalesce(old.driver_doc,'');
  IF trim(_driver_name) <> old.driver_name THEN changes := changes || jsonb_build_object('driver_name', jsonb_build_array(old.driver_name, trim(_driver_name))); END IF;
  IF trim(_driver_doc) <> coalesce(old.driver_doc,'') THEN changes := changes || jsonb_build_object('driver_doc', jsonb_build_array(old.driver_doc, trim(_driver_doc))); END IF;
  IF upper(trim(_tractor_plate)) <> old.tractor_plate THEN changes := changes || jsonb_build_object('tractor_plate', jsonb_build_array(old.tractor_plate, upper(trim(_tractor_plate)))); END IF;
  IF coalesce(nullif(upper(trim(coalesce(_trailer_plate,''))),''),'') <> coalesce(old.trailer_plate,'') THEN changes := changes || jsonb_build_object('trailer_plate', jsonb_build_array(old.trailer_plate, nullif(upper(trim(coalesce(_trailer_plate,''))),''))); END IF;
  IF changes = '{}'::jsonb THEN RETURN; END IF;
  IF drv THEN changes := changes || jsonb_build_object('qr_reissued', true); END IF;
  UPDATE public.reservations SET driver_name = trim(_driver_name), driver_doc = trim(_driver_doc),
    tractor_plate = upper(trim(_tractor_plate)), trailer_plate = nullif(upper(trim(coalesce(_trailer_plate,''))),''),
    qr_token = CASE WHEN drv THEN gen_random_uuid() ELSE qr_token END, qr_valid = true
   WHERE id = _id;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes) VALUES (_id, auth.uid(), 'update', changes);
END $$;

-- Carrier cancel before arrival; under 24h it is flagged as subject to penalty (no charge).
CREATE OR REPLACE FUNCTION public.carrier_cancel_reservation(_id uuid, _reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; old public.reservations; late boolean;
BEGIN
  cid := public.carrier_company();
  SELECT * INTO old FROM public.reservations WHERE id = _id AND company_id = cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  IF old.status <> 'confirmed' THEN RAISE EXCEPTION 'ERR_NOT_EDITABLE'; END IF;
  late := old.starts_at < now() + interval '24 hours';
  UPDATE public.reservations SET status = 'cancelled', cancel_reason = nullif(trim(coalesce(_reason,'')),''), qr_valid = false, penalty = late WHERE id = _id;
  INSERT INTO public.reservation_audit (reservation_id, actor_id, action, changes)
    VALUES (_id, auth.uid(), 'cancel', jsonb_build_object('reason', nullif(trim(coalesce(_reason,'')),''), 'penalty', late));
  RETURN late;
END $$;

REVOKE EXECUTE ON FUNCTION public.carrier_company() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.carrier_available_slots(date, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.carrier_create_reservation(date, text, jsonb, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.carrier_update_driver(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.carrier_cancel_reservation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carrier_available_slots(date, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.carrier_create_reservation(date, text, jsonb, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.carrier_update_driver(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.carrier_cancel_reservation(uuid, text) TO authenticated;