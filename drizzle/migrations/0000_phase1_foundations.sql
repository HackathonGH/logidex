CREATE TYPE public.app_role AS ENUM ('admin','administrativo','transportista','bascula','almacen');

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_id text NOT NULL UNIQUE,
  phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  username text UNIQUE,
  full_name text,
  language text NOT NULL DEFAULT 'es' CHECK (language IN ('es','en','ca')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','disabled')),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  is_internal boolean NOT NULL DEFAULT false,
  must_change_password boolean NOT NULL DEFAULT false,
  can_scan_qr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.company_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_new_company boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contact_phone text NOT NULL DEFAULT '93 325 25 25',
  contact_email text NOT NULL DEFAULT 'Incidexsolutions@gmail.com',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1);

GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, language) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.company_link_requests TO authenticated;
GRANT ALL ON public.company_link_requests TO service_role;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'administrativo')
$$;

CREATE POLICY "own profile or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "own company or managers" ON public.companies FOR SELECT TO authenticated
  USING (public.is_staff_manager(auth.uid())
    OR id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR id IN (SELECT company_id FROM public.company_link_requests WHERE user_id = auth.uid()));

CREATE POLICY "own requests or admin" ON public.company_link_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "settings readable" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.submit_company_registration(_name text, _tax_id text, _phone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid; _new boolean := false; _norm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_internal) THEN RAISE EXCEPTION 'internal account'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_link_requests WHERE user_id = auth.uid() AND status = 'pending') THEN RAISE EXCEPTION 'request already pending'; END IF;
  _norm := upper(regexp_replace(coalesce(_tax_id,''), '[^A-Za-z0-9]', '', 'g'));
  IF length(_norm) < 5 OR length(trim(coalesce(_name,''))) < 2 THEN RAISE EXCEPTION 'invalid data'; END IF;
  SELECT id INTO _cid FROM public.companies WHERE tax_id = _norm;
  IF _cid IS NULL THEN
    INSERT INTO public.companies (name, tax_id, phone, created_by) VALUES (trim(_name), _norm, _phone, auth.uid()) RETURNING id INTO _cid;
    _new := true;
  END IF;
  INSERT INTO public.company_link_requests (user_id, company_id, is_new_company) VALUES (auth.uid(), _cid, _new);
  UPDATE public.profiles SET status = 'pending' WHERE id = auth.uid();
  RETURN CASE WHEN _new THEN 'new' ELSE 'link' END;
END $$;

CREATE OR REPLACE FUNCTION public.review_link_request(_request_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.company_link_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.company_link_requests WHERE id = _request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  UPDATE public.company_link_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(), reviewed_at = now() WHERE id = r.id;
  IF _approve THEN
    UPDATE public.companies SET status = 'approved' WHERE id = r.company_id;
    UPDATE public.profiles SET company_id = r.company_id, status = 'active' WHERE id = r.user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, 'transportista') ON CONFLICT DO NOTHING;
  ELSE
    IF r.is_new_company THEN UPDATE public.companies SET status = 'rejected' WHERE id = r.company_id; END IF;
    UPDATE public.profiles SET status = 'rejected' WHERE id = r.user_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_user(_user_id uuid, _status text, _can_scan boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user_id = auth.uid() AND _status = 'disabled' THEN RAISE EXCEPTION 'cannot disable yourself'; END IF;
  UPDATE public.profiles SET status = COALESCE(_status, status), can_scan_qr = COALESCE(_can_scan, can_scan_qr) WHERE id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_settings(_phone text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.app_settings SET contact_phone = _phone, contact_email = _email, updated_at = now() WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET must_change_password = false WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_company_registration(text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_link_request(uuid,boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid,text,boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_settings(text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_company_registration(text,text,text), public.review_link_request(uuid,boolean), public.admin_update_user(uuid,text,boolean), public.admin_update_settings(text,text), public.complete_password_change(), public.has_role(uuid,public.app_role), public.is_staff_manager(uuid) TO authenticated;