-- Risk level for open ports
DO $$ BEGIN
  CREATE TYPE public.port_risk AS ENUM ('info','low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.scan_job_status AS ENUM ('queued','running','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.scan_profile AS ENUM ('discovery','quick','default','intense','vuln');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.network_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id TEXT NOT NULL,
  target TEXT NOT NULL,
  profile public.scan_profile NOT NULL DEFAULT 'default',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  host_count INTEGER NOT NULL DEFAULT 0,
  open_port_count INTEGER NOT NULL DEFAULT 0,
  high_risk_count INTEGER NOT NULL DEFAULT 0,
  raw_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scan_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.network_scans(id) ON DELETE CASCADE,
  ip TEXT NOT NULL,
  mac TEXT,
  hostname TEXT,
  vendor TEXT,
  os_guess TEXT,
  os_accuracy INTEGER,
  status TEXT NOT NULL DEFAULT 'up',
  open_port_count INTEGER NOT NULL DEFAULT 0,
  highest_risk public.port_risk NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_hosts_scan ON public.scan_hosts(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_hosts_ip ON public.scan_hosts(ip);

CREATE TABLE IF NOT EXISTS public.scan_ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.scan_hosts(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES public.network_scans(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  state TEXT NOT NULL DEFAULT 'open',
  service TEXT,
  product TEXT,
  version TEXT,
  extra_info TEXT,
  cpe TEXT,
  risk public.port_risk NOT NULL DEFAULT 'info',
  risk_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_ports_host ON public.scan_ports(host_id);
CREATE INDEX IF NOT EXISTS idx_scan_ports_scan ON public.scan_ports(scan_id);

CREATE TABLE IF NOT EXISTS public.scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL,
  profile public.scan_profile NOT NULL DEFAULT 'default',
  status public.scan_job_status NOT NULL DEFAULT 'queued',
  requested_by UUID,
  assigned_sensor TEXT,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scan_id UUID REFERENCES public.network_scans(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON public.scan_jobs(status);

CREATE TRIGGER trg_scan_jobs_updated BEFORE UPDATE ON public.scan_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.network_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_hosts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_ports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_jobs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scans viewable by authenticated" ON public.network_scans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage scans" ON public.network_scans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Scan hosts viewable by authenticated" ON public.scan_hosts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage scan hosts" ON public.scan_hosts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Scan ports viewable by authenticated" ON public.scan_ports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage scan ports" ON public.scan_ports
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Scan jobs viewable by authenticated" ON public.scan_jobs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage scan jobs" ON public.scan_jobs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));