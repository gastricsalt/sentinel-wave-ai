
-- Kill chain stage enum
DO $$ BEGIN
  CREATE TYPE public.kill_chain_stage AS ENUM ('recon','weaponization','delivery','exploitation','installation','c2','actions');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM ('open','investigating','contained','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Threat actors (attacker profiles)
CREATE TABLE IF NOT EXISTS public.threat_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  label text NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  attack_count integer NOT NULL DEFAULT 0,
  preferred_channels integer[] NOT NULL DEFAULT '{}',
  preferred_types text[] NOT NULL DEFAULT '{}',
  source_macs text[] NOT NULL DEFAULT '{}',
  notes text,
  risk_score integer NOT NULL DEFAULT 50
);
ALTER TABLE public.threat_actors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Actors viewable by authenticated" ON public.threat_actors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage actors" ON public.threat_actors FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Incidents
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  status public.incident_status NOT NULL DEFAULT 'open',
  severity public.severity_level NOT NULL DEFAULT 'warning',
  current_stage public.kill_chain_stage NOT NULL DEFAULT 'recon',
  actor_id uuid REFERENCES public.threat_actors(id) ON DELETE SET NULL,
  affected_bssids text[] NOT NULL DEFAULT '{}',
  affected_clients text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  ai_narrative text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Incidents viewable by authenticated" ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage incidents" ON public.incidents FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chain events
CREATE TABLE IF NOT EXISTS public.attack_chain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  threat_id uuid REFERENCES public.threats(id) ON DELETE SET NULL,
  sequence integer NOT NULL,
  stage public.kill_chain_stage NOT NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  bssid text,
  source_mac text,
  target_mac text,
  metadata jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chain_events_incident ON public.attack_chain_events(incident_id, sequence);
ALTER TABLE public.attack_chain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chain events viewable by authenticated" ON public.attack_chain_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage chain events" ON public.attack_chain_events FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Sensors
CREATE TABLE IF NOT EXISTS public.sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id text NOT NULL UNIQUE,
  label text NOT NULL,
  x_meters numeric NOT NULL DEFAULT 0,
  y_meters numeric NOT NULL DEFAULT 0,
  floor text NOT NULL DEFAULT 'main',
  last_seen timestamptz NOT NULL DEFAULT now(),
  online boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sensors viewable by authenticated" ON public.sensors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sensors" ON public.sensors FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- RSSI observations
CREATE TABLE IF NOT EXISTS public.rssi_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id text NOT NULL,
  target_bssid text NOT NULL,
  rssi integer NOT NULL,
  channel integer,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rssi_target_time ON public.rssi_observations(target_bssid, observed_at DESC);
ALTER TABLE public.rssi_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RSSI viewable by authenticated" ON public.rssi_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rssi" ON public.rssi_observations FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Link threats -> incidents / actors
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL;
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.threat_actors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_threats_incident ON public.threats(incident_id);
CREATE INDEX IF NOT EXISTS idx_threats_actor ON public.threats(actor_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attack_chain_events;

-- Seed 3 demo sensors
INSERT INTO public.sensors (sensor_id, label, x_meters, y_meters, floor) VALUES
  ('sensor-nw', 'NW Corner', 5, 5, 'main'),
  ('sensor-ne', 'NE Corner', 45, 5, 'main'),
  ('sensor-s',  'South Hall', 25, 35, 'main')
ON CONFLICT (sensor_id) DO NOTHING;
