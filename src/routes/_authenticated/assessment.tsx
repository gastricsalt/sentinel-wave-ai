import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getAssessmentSummary,
  listCves,
  listRecommendations,
  updateRecommendation,
  runAssessment,
  listBaseline,
  upsertBaseline,
  getWifiVulnerabilities,
  runWifiAssessment,
} from "@/lib/assessment.functions";
import { listScans } from "@/lib/recon.functions";
import { PageHeader, Card, StatCard, SeverityPill } from "@/components/ui-kit";
import { ShieldCheck, AlertTriangle, PlayCircle, ExternalLink, CheckCircle2, Plus, Wifi, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assessment")({
  head: () => ({ meta: [{ title: "Vulnerability Assessment — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const summaryFn = useServerFn(getAssessmentSummary);
  const cvesFn = useServerFn(listCves);
  const recsFn = useServerFn(listRecommendations);
  const updRec = useServerFn(updateRecommendation);
  const runFn = useServerFn(runAssessment);
  const scansFn = useServerFn(listScans);
  const baselineFn = useServerFn(listBaseline);
  const addBaseline = useServerFn(upsertBaseline);

  const sumQ = useQuery({ queryKey: ["assessment-summary"], queryFn: () => summaryFn(), refetchInterval: 15_000 });
  const cveQ = useQuery({ queryKey: ["cves"], queryFn: () => cvesFn({ data: {} }) });
  const recQ = useQuery({ queryKey: ["recs"], queryFn: () => recsFn() });
  const scanQ = useQuery({ queryKey: ["scans"], queryFn: () => scansFn() });
  const baseQ = useQuery({ queryKey: ["baseline"], queryFn: () => baselineFn() });

  const runMut = useMutation({
    mutationFn: (id: string) => runFn({ data: { scanId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-summary"] });
      qc.invalidateQueries({ queryKey: ["cves"] });
      qc.invalidateQueries({ queryKey: ["recs"] });
    },
  });
  const recMut = useMutation({
    mutationFn: (v: { id: string; status: "open" | "in_progress" | "resolved" | "dismissed" }) =>
      updRec({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recs"] }),
  });
  const baselineMut = useMutation({
    mutationFn: (v: { mac: string; label?: string }) => addBaseline({ data: { ...v, approved: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["baseline"] }),
  });

  const s = sumQ.data;
  const cves = cveQ.data?.cves ?? [];
  const recs = recQ.data?.recommendations ?? [];
  const scans = scanQ.data?.scans ?? [];
  const baseline = baseQ.data?.devices ?? [];

  const score = s?.score?.overall ?? null;
  const [newMac, setNewMac] = useState("");
  const [newLabel, setNewLabel] = useState("");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Vulnerability Assessment"
        subtitle="CVE correlation, AI risk scoring, and remediation guidance for discovered hosts and services"
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Security score"
          value={score !== null ? `${score}/100` : "—"}
          hint={score !== null ? scoreVerdict(score) : "Run assessment to compute"}
          accent={score === null ? "default" : score >= 80 ? "ok" : score >= 60 ? "warn" : "danger"}
        />
        <StatCard label="Critical CVEs" value={s?.cveBuckets.critical ?? 0} accent={(s?.cveBuckets.critical ?? 0) > 0 ? "danger" : "ok"} />
        <StatCard label="High CVEs" value={s?.cveBuckets.high ?? 0} accent={(s?.cveBuckets.high ?? 0) > 0 ? "warn" : "ok"} />
        <StatCard label="Open recs" value={s?.openRecs ?? 0} accent="warn" />
        <StatCard label="Baseline devices" value={baseline.length} hint="Approved MACs" />
      </div>

      {s?.score && (
        <Card title="Posture breakdown" className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreBar label="Wireless" value={s.score.wireless} />
            <ScoreBar label="Network" value={s.score.network} />
            <ScoreBar label="IoT" value={s.score.iot} />
            <ScoreBar label="Encryption" value={s.score.encryption} />
          </div>
        </Card>
      )}

      <Card title="Run assessment on a scan" className="mb-6">
        <div className="space-y-2">
          {scans.length === 0 && <p className="text-sm text-muted-foreground">No scans yet — run Network Recon first.</p>}
          {scans.slice(0, 5).map((sc) => (
            <div key={sc.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-surface/40">
              <div>
                <div className="text-sm font-mono">{sc.target}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(sc.started_at).toLocaleString()} · {sc.host_count} hosts · {sc.open_port_count} open ports
                </div>
              </div>
              <button
                onClick={() => runMut.mutate(sc.id)}
                disabled={runMut.isPending}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" /> {runMut.isPending ? "Analyzing…" : "Analyze"}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title={`CVE findings (${cves.length})`}>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {cves.length === 0 && <p className="text-sm text-muted-foreground">No CVEs matched yet.</p>}
            {cves.map((c: any) => (
              <div key={c.id} className="p-3 rounded-md border border-border bg-surface/40">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-mono text-xs">{c.cve_id} · CVSS {c.cvss}</div>
                  <SeverityPill severity={c.severity === "critical" ? "critical" : c.severity === "high" ? "high" : c.severity === "medium" ? "warning" : "info"} />
                </div>
                <div className="text-sm">{c.summary}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {c.scan_hosts?.ip} ({c.scan_hosts?.hostname ?? "—"}) · {c.product ?? "?"} {c.version ?? ""}
                  {c.exploit_available && <span className="ml-2 text-destructive">· public exploit</span>}
                  {c.reference_url && (
                    <a href={c.reference_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                      ref <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={`Recommendations (${recs.length})`}>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recs.length === 0 && <p className="text-sm text-muted-foreground">No recommendations yet.</p>}
            {recs.map((r: any) => (
              <div key={r.id} className="p-3 rounded-md border border-border bg-surface/40">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {r.priority === "critical" ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> : <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                    {r.title}
                  </div>
                  <SeverityPill severity={r.priority === "critical" ? "critical" : r.priority === "high" ? "high" : r.priority === "medium" ? "warning" : "info"} />
                </div>
                <div className="text-xs text-muted-foreground">{r.rationale}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.status}</span>
                  {r.status !== "resolved" && (
                    <button
                      onClick={() => recMut.mutate({ id: r.id, status: "resolved" })}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-success/15 text-success border border-success/40"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Mark resolved
                    </button>
                  )}
                  {r.status === "open" && (
                    <button
                      onClick={() => recMut.mutate({ id: r.id, status: "dismissed" })}
                      className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Network baseline (approved devices)">
        <div className="flex items-end gap-2 mb-4 flex-wrap">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">MAC</label>
            <input value={newMac} onChange={(e) => setNewMac(e.target.value)} placeholder="aa:bb:cc:dd:ee:ff" className="mt-1 bg-input border border-border rounded-md px-3 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Label</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="CFO laptop" className="mt-1 bg-input border border-border rounded-md px-3 py-1.5 text-sm" />
          </div>
          <button
            onClick={() => { if (newMac) { baselineMut.mutate({ mac: newMac, label: newLabel || undefined }); setNewMac(""); setNewLabel(""); } }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium"
          ><Plus className="w-3.5 h-3.5" /> Approve device</button>
        </div>
        <div className="space-y-1">
          {baseline.length === 0 && <p className="text-sm text-muted-foreground">No approved devices. Anything seen will be flagged as unauthorized.</p>}
          {baseline.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-elevated text-sm">
              <div>
                <span className="font-mono">{b.mac}</span>
                {b.label && <span className="ml-2 text-muted-foreground">— {b.label}</span>}
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(b.last_seen).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-success" : value >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function scoreVerdict(s: number): string {
  if (s >= 90) return "Excellent posture";
  if (s >= 75) return "Acceptable — minor gaps";
  if (s >= 60) return "Weak — remediate soon";
  if (s >= 40) return "Poor — high exposure";
  return "Critical — immediate action";
}
