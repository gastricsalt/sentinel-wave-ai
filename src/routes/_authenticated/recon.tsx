import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listScans, listScanJobs, queueScan, cancelScanJob, getScan } from "@/lib/recon.functions";
import { PageHeader, Card, StatCard, SeverityPill } from "@/components/ui-kit";
import { Radar, PlayCircle, X, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recon")({
  head: () => ({ meta: [{ title: "Recon — SentinelWave AI" }] }),
  component: Page,
});

const PROFILE_HINT: Record<string, string> = {
  discovery: "Ping sweep only — fast host discovery",
  quick: "Top 100 ports, no version detection",
  default: "Top 1000 ports + service banners",
  intense: "Full TCP + OS + version detection (slow)",
  vuln: "Vulners NSE scripts — CVE lookup per service",
};

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listScans);
  const jobs = useServerFn(listScanJobs);
  const queue = useServerFn(queueScan);
  const cancel = useServerFn(cancelScanJob);

  const scansQ = useQuery({ queryKey: ["scans"], queryFn: () => list(), refetchInterval: 10_000 });
  const jobsQ = useQuery({ queryKey: ["scan-jobs"], queryFn: () => jobs(), refetchInterval: 5_000 });

  const [target, setTarget] = useState("192.168.1.0/24");
  const [profile, setProfile] = useState<"discovery" | "quick" | "default" | "intense" | "vuln">("default");
  const [openId, setOpenId] = useState<string | null>(null);

  const queueMut = useMutation({
    mutationFn: () => queue({ data: { target, profile } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-jobs"] }),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-jobs"] }),
  });

  const scans = scansQ.data?.scans ?? [];
  const totalHosts = scans.reduce((n, s) => n + (s.host_count ?? 0), 0);
  const totalOpen = scans.reduce((n, s) => n + (s.open_port_count ?? 0), 0);
  const totalHigh = scans.reduce((n, s) => n + (s.high_risk_count ?? 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Network Recon"
        subtitle="Authorized nmap scans executed by your Linux sensor — discovers hosts, services, and exposure"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Scans" value={scans.length} hint="Last 50" />
        <StatCard label="Hosts seen" value={totalHosts} accent="default" />
        <StatCard label="Open ports" value={totalOpen} accent="warn" />
        <StatCard label="High/critical exposures" value={totalHigh} accent={totalHigh > 0 ? "danger" : "ok"} />
      </div>

      <Card title="Queue a scan" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Target (CIDR / IP / range / host)</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="192.168.1.0/24"
              className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="md:col-span-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Profile</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as typeof profile)}
              className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            >
              {Object.keys(PROFILE_HINT).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">{PROFILE_HINT[profile]}</p>
          </div>
          <div className="md:col-span-3">
            <button
              onClick={() => queueMut.mutate()}
              disabled={queueMut.isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" /> {queueMut.isPending ? "Queueing…" : "Queue scan"}
            </button>
          </div>
        </div>
        {queueMut.error && (
          <p className="text-xs text-destructive mt-3">{(queueMut.error as Error).message}</p>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Only scan networks you are authorized to assess. Jobs are picked up by the next polling sensor agent.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Job queue">
          <div className="space-y-2">
            {(jobsQ.data?.jobs ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            )}
            {(jobsQ.data?.jobs ?? []).map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-surface/40">
                <div className="min-w-0">
                  <div className="text-sm font-mono truncate">{j.target}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {j.profile} · {new Date(j.created_at).toLocaleString()} {j.assigned_sensor ? `· ${j.assigned_sensor}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <JobStatus status={j.status} />
                  {j.status === "queued" && (
                    <button
                      onClick={() => cancelMut.mutate(j.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label="Cancel"
                    ><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent scans">
          <div className="space-y-1">
            {scans.length === 0 && <p className="text-sm text-muted-foreground">No scans yet — queue one above.</p>}
            {scans.map((s) => (
              <button
                key={s.id}
                onClick={() => setOpenId(openId === s.id ? null : s.id)}
                className="w-full flex items-center justify-between p-3 rounded-md hover:bg-surface-elevated text-left"
              >
                <div className="min-w-0">
                  <div className="text-sm font-mono truncate flex items-center gap-2">
                    <Radar className="w-3.5 h-3.5 text-primary" /> {s.target}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.host_count} hosts · {s.open_port_count} open · {new Date(s.started_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {s.high_risk_count > 0 && <SeverityPill severity="high" />}
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition ${openId === s.id ? "rotate-90" : ""}`} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {openId && <ScanDetail id={openId} />}
    </div>
  );
}

function JobStatus({ status }: { status: string }) {
  const tone: Record<string, string> = {
    queued: "bg-muted text-muted-foreground border-border",
    running: "bg-primary/15 text-primary border-primary/40 animate-pulse",
    completed: "bg-success/15 text-success border-success/40",
    failed: "bg-destructive/15 text-destructive border-destructive/40",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${tone[status] ?? tone.queued}`}>{status}</span>;
}

function ScanDetail({ id }: { id: string }) {
  const get = useServerFn(getScan);
  const { data } = useQuery({ queryKey: ["scan", id], queryFn: () => get({ data: { id } }) });
  if (!data?.scan) return null;

  const portsByHost: Record<string, typeof data.ports> = {};
  for (const p of data.ports) (portsByHost[p.host_id] ??= []).push(p);

  return (
    <Card title={`Scan detail — ${data.scan.target}`} className="mt-6">
      <div className="space-y-4">
        {data.hosts.map((h) => (
          <div key={h.id} className="border border-border rounded-lg p-4 bg-surface/40">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div>
                <div className="font-mono text-sm">{h.ip} {h.hostname && <span className="text-muted-foreground">({h.hostname})</span>}</div>
                <div className="text-[11px] text-muted-foreground">
                  {[h.vendor, h.mac, h.os_guess].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <SeverityPill severity={h.highest_risk === "critical" ? "critical" : h.highest_risk === "high" ? "high" : h.highest_risk === "medium" ? "warning" : "info"} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1.5 pr-3">Port</th>
                    <th className="py-1.5 pr-3">Service</th>
                    <th className="py-1.5 pr-3">Product / version</th>
                    <th className="py-1.5 pr-3">Risk</th>
                    <th className="py-1.5">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {(portsByHost[h.id] ?? []).map((p) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 font-mono">{p.port}/{p.protocol}</td>
                      <td className="py-1.5 pr-3">{p.service ?? "—"}</td>
                      <td className="py-1.5 pr-3">{[p.product, p.version].filter(Boolean).join(" ") || "—"}</td>
                      <td className="py-1.5 pr-3"><SeverityPill severity={p.risk === "critical" ? "critical" : p.risk === "high" ? "high" : p.risk === "medium" ? "warning" : "info"} /></td>
                      <td className="py-1.5 text-muted-foreground">{p.risk_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
