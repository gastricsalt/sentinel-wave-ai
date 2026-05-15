
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst');
CREATE TYPE public.threat_type AS ENUM ('rogue_ap', 'evil_twin', 'deauth_flood', 'beacon_flood', 'mac_spoof', 'anomaly');
CREATE TYPE public.severity_level AS ENUM ('info', 'warning', 'high', 'critical');

-- ===== UTIL =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger: create profile + role on signup. First user => admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO _is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_first THEN 'admin'::public.app_role ELSE 'analyst'::public.app_role END);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== ACCESS POINTS =====
CREATE TABLE public.access_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ssid TEXT,
  bssid TEXT NOT NULL UNIQUE,
  channel INTEGER,
  encryption TEXT,
  vendor TEXT,
  signal_strength INTEGER,
  is_rogue BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.access_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "APs viewable by authenticated" ON public.access_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage APs" ON public.access_points FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_aps_last_seen ON public.access_points(last_seen DESC);
CREATE INDEX idx_aps_ssid ON public.access_points(ssid);

-- ===== CLIENTS =====
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mac TEXT NOT NULL UNIQUE,
  vendor TEXT,
  associated_bssid TEXT,
  packets_seen INTEGER NOT NULL DEFAULT 0,
  signal_strength INTEGER,
  is_random_mac BOOLEAN NOT NULL DEFAULT false,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients viewable by authenticated" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage clients" ON public.clients FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_clients_last_seen ON public.clients(last_seen DESC);

-- ===== THREATS =====
CREATE TABLE public.threats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.threat_type NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'warning',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  bssid TEXT,
  ssid TEXT,
  source_mac TEXT,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.threats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Threats viewable by authenticated" ON public.threats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update threats" ON public.threats FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete threats" ON public.threats FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_threats_detected ON public.threats(detected_at DESC);
CREATE INDEX idx_threats_severity ON public.threats(severity);

-- ===== ALERTS =====
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'info',
  threat_id UUID REFERENCES public.threats(id) ON DELETE CASCADE,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alerts viewable by authenticated" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update alerts" ON public.alerts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete alerts" ON public.alerts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_alerts_created ON public.alerts(created_at DESC);

-- ===== INGEST EVENTS =====
CREATE TABLE public.ingest_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  threat_count INTEGER NOT NULL DEFAULT 0,
  ap_count INTEGER NOT NULL DEFAULT 0,
  client_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ingest_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ingest events viewable by admins" ON public.ingest_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_ingest_created ON public.ingest_events(created_at DESC);

-- ===== REALTIME =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.threats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_points;
