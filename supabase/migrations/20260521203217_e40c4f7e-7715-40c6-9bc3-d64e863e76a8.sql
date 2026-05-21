
-- CVE findings linked to scan hosts / ports
CREATE TABLE public.host_cves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  scan_id uuid NOT NULL,
  port_id uuid,
  cve_id text NOT NULL,
  cvss numeric NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info',
  summary text NOT NULL,
  product text,
  version text,
  exploit_available boolean NOT NULL DEFAULT false,
  reference_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_host_cves_scan ON public.host_cves(scan_id);
CREATE INDEX idx_host_cves_host ON public.host_cves(host_id);
ALTER TABLE public.host_cves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CVEs viewable by authenticated" ON public.host_cves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cves" ON public.host_cves FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Remediation recommendations
CREATE TYPE public.rec_status AS ENUM ('open','in_progress','resolved','dismissed');
CREATE TYPE public.rec_priority AS ENUM ('low','medium','high','critical');
CREATE TABLE public.security_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  rationale text NOT NULL,
  category text NOT NULL DEFAULT 'network',
  priority public.rec_priority NOT NULL DEFAULT 'medium',
  status public.rec_status NOT NULL DEFAULT 'open',
  host_id uuid,
  scan_id uuid,
  threat_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rec_status ON public.security_recommendations(status);
ALTER TABLE public.security_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recs viewable by authenticated" ON public.security_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage recs" ON public.security_recommendations FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rec_updated BEFORE UPDATE ON public.security_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security posture score per scan
CREATE TABLE public.security_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid,
  computed_at timestamptz NOT NULL DEFAULT now(),
  overall integer NOT NULL DEFAULT 100,
  wireless integer NOT NULL DEFAULT 100,
  network integer NOT NULL DEFAULT 100,
  iot integer NOT NULL DEFAULT 100,
  encryption integer NOT NULL DEFAULT 100,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.security_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scores viewable by authenticated" ON public.security_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage scores" ON public.security_scores FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Network baseline of approved devices
CREATE TABLE public.network_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mac text,
  ip text,
  label text,
  device_type text,
  approved boolean NOT NULL DEFAULT true,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE UNIQUE INDEX idx_baseline_mac ON public.network_baseline(mac) WHERE mac IS NOT NULL;
ALTER TABLE public.network_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Baseline viewable by authenticated" ON public.network_baseline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage baseline" ON public.network_baseline FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
