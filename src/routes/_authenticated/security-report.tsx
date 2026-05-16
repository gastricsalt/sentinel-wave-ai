import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReportData } from "@/lib/ai-analyst.functions";
import { Printer, FileDown, Shield, AlertTriangle, Wifi, Users, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/security-report")({
  head: () => ({ meta: [{ title: "Security Report — SentinelWave AI" }] }),
  component: Page,
});

const RATING_COLOR: Record<string, string> = {
  low: "var(--success)",
  moderate: "oklch(0.75 0.18 65)",
  elevated: "oklch(0.78 0.16 50)",
  high: "oklch(0.62 0.24 25)",
  critical: "oklch(0.55 0.26 25)",
};

function Page() {
  const fn = useServerFn(getReportData);
  const { data, isLoading } = useQuery({ queryKey: ["report-data"], queryFn: () => fn() });

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Compiling 7-day security report…</div>;
  }

  const ratingColor = RATING_COLOR[data.risk.rating] ?? "var(--primary)";
  const generatedDate = new Date(data.generatedAt);

  function printPdf() {
    window.print();
  }

  return (
    <div className="report-root">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
          .report-root { background: white !important; color: black !important; }
          .report-root * { color: black !important; border-color: #ddd !important; background: white !important; box-shadow: none !important; }
          .report-root .badge-keep { background: #f0f0f0 !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-8 py-3 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Security Report · </span>
          <span className="font-medium">7-day window</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={printPdf} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:border-primary/40 transition">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={printPdf} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <FileDown className="w-4 h-4" /> Save as PDF
          </button>
        </div>
      </div>

      <div className="max-w-[920px] mx-auto px-10 py-10 print:py-0">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">SentinelWave AI · WIDS</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Wireless Security Posture Report</h1>
            <p className="text-sm text-muted-foreground mt-1">Reporting period: last {data.windowDays} days · Generated {generatedDate.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Risk score</div>
            <div className="text-5xl font-semibold tabular-nums" style={{ color: ratingColor }}>{data.risk.score}</div>
            <div className="text-xs uppercase tracking-[0.18em] mt-1 badge-keep px-2 py-0.5 rounded" style={{ background: "color-mix(in oklab, " + ratingColor + " 15%, transparent)", color: ratingColor }}>
              {data.risk.rating}
            </div>
          </div>
        </header>

        {/* Exec summary stats */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <Stat icon={AlertTriangle} label="Threats" value={data.totals.threats} accent="warn" />
          <Stat icon={AlertTriangle} label="Critical alerts" value={data.totals.criticalAlerts} accent="danger" />
          <Stat icon={AlertTriangle} label="Unack'd" value={data.totals.unacknowledged} />
          <Stat icon={Wifi} label="APs / rogue" value={`${data.totals.aps} / ${data.totals.rogueAps}`} />
          <Stat icon={Users} label="Clients" value={data.totals.clients} />
        </section>

        {/* Executive summary */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Executive summary</h2>
          <div className="text-sm leading-relaxed text-foreground/90">
            Over the past {data.windowDays} days, SentinelWave processed
            {" "}<strong>{data.totals.threats}</strong> wireless detections across
            {" "}<strong>{data.totals.aps}</strong> tracked access points and
            {" "}<strong>{data.totals.clients}</strong> distinct clients.
            The environment's composite risk score is
            {" "}<strong style={{ color: ratingColor }}>{data.risk.score}/100 ({data.risk.rating})</strong>.
            {data.totals.rogueAps > 0 && <> {data.totals.rogueAps} AP{data.totals.rogueAps !== 1 && "s"} are flagged rogue and require immediate investigation.</>}
            {data.totals.unacknowledged > 0 && <> {data.totals.unacknowledged} detection{data.totals.unacknowledged !== 1 && "s"} remain unacknowledged.</>}
          </div>
        </section>

        {/* Charts */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-medium mb-3">Detection volume · 7 days</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeline}>
                  <CartesianGrid stroke="oklch(0.62 0.22 275 / 12%)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#666", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#666", fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="oklch(0.62 0.22 275)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="critical" stroke="oklch(0.62 0.24 25)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-medium mb-3">Severity breakdown</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(data.bySeverity).map(([k, v]) => ({ severity: k, count: v }))}>
                  <CartesianGrid stroke="oklch(0.62 0.22 275 / 12%)" strokeDasharray="3 3" />
                  <XAxis dataKey="severity" tick={{ fill: "#666", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#666", fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="oklch(0.62 0.22 275)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Findings + Remediation */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Findings &amp; remediation</h2>
          {data.activeFindings.length === 0 && (
            <p className="text-sm text-muted-foreground">No active findings in the reporting window.</p>
          )}
          <div className="space-y-5">
            {data.activeFindings.map((f) => (
              <article key={f.type} className="rounded-xl border border-border p-5">
                <header className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{f.kb.category}</div>
                    <h3 className="text-base font-semibold">{f.kb.label}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Occurrences</div>
                    <div className="text-xl font-semibold tabular-nums">{f.count}</div>
                  </div>
                </header>
                <p className="text-sm mb-3 text-foreground/85">{f.kb.summary}</p>
                <p className="text-xs text-muted-foreground mb-3"><strong className="text-foreground">Risk:</strong> {f.kb.risk}</p>
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Indicators</div>
                    <ul className="space-y-1 list-disc pl-4">
                      {f.kb.indicators.map((i) => <li key={i}>{i}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Remediation</div>
                    <ol className="space-y-1 list-decimal pl-4">
                      {f.kb.remediation.map((r) => <li key={r}>{r}</li>)}
                    </ol>
                  </div>
                </div>
                {f.kb.references.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
                    References: {f.kb.references.map((r, i) => (
                      <span key={r.url}>
                        {i > 0 && " · "}
                        <a href={r.url} className="text-primary hover:underline" target="_blank" rel="noreferrer">{r.label}</a>
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Detection log */}
        <section className="mt-10 page-break">
          <h2 className="text-lg font-semibold mb-4">Recent detection log</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Severity</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">BSSID</th>
                <th className="py-2 pr-3">Conf</th>
              </tr>
            </thead>
            <tbody>
              {data.topThreats.map((t) => (
                <tr key={t.id} className="border-b border-border/50 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(t.detected_at).toLocaleString()}</td>
                  <td className="py-1.5 pr-3 uppercase tracking-wider">{t.severity}</td>
                  <td className="py-1.5 pr-3">{t.type}</td>
                  <td className="py-1.5 pr-3">{t.description}</td>
                  <td className="py-1.5 pr-3 font-mono">{t.bssid ?? t.source_mac ?? "—"}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{Number(t.confidence).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="mt-10 pt-4 border-t border-border text-[11px] text-muted-foreground">
          SentinelWave AI · Generated automatically from real-time WIDS telemetry · Confidential
        </footer>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Shield; label: string; value: string | number; accent?: "danger" | "warn" }) {
  const color = accent === "danger" ? "text-destructive" : accent === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
