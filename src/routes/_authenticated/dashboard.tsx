import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats, getMyRole } from "@/lib/sentinel.functions";
import { runSimulationTick, injectAttack, wipeDemoData } from "@/lib/simulator.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, Card, SeverityPill } from "@/components/ui-kit";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { Play, Pause, Zap, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Console — SentinelWave AI" }] }),
  component: Dashboard,
});

const ATTACK_BUTTONS: Array<{ type: "rogue_ap" | "evil_twin" | "deauth_flood" | "beacon_flood" | "mac_spoof"; label: string }> = [
  { type: "evil_twin", label: "Evil Twin" },
  { type: "deauth_flood", label: "Deauth Flood" },
  { type: "rogue_ap", label: "Rogue AP" },
  { type: "beacon_flood", label: "Beacon Flood" },
  { type: "mac_spoof", label: "MAC Spoof" },
];

const PIE_COLORS = ["oklch(0.62 0.22 275)", "oklch(0.70 0.18 200)", "oklch(0.75 0.18 65)", "oklch(0.62 0.24 25)", "oklch(0.70 0.18 160)", "oklch(0.55 0.20 320)"];

function Dashboard() {
  const qc = useQueryClient();
  const stats = useServerFn(getDashboardStats);
  const role = useServerFn(getMyRole);
  const tick = useServerFn(runSimulationTick);
  const inject = useServerFn(injectAttack);
  const wipe = useServerFn(wipeDemoData);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => stats() });
  const { data: roleData } = useQuery({ queryKey: ["my-role"], queryFn: () => role() });
  const isAdmin = roleData?.isAdmin ?? false;

  const [demoMode, setDemoMode] = useState(false);

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel("realtime-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "threats" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Demo mode tick
  useEffect(() => {
    if (!demoMode) return;
    const id = setInterval(() => { tick().catch(() => {}); }, 5000);
    tick().catch(() => {});
    return () => clearInterval(id);
  }, [demoMode, tick]);

  const injectMut = useMutation({ mutationFn: (type: typeof ATTACK_BUTTONS[number]["type"]) => inject({ data: { type } }) });
  const wipeMut = useMutation({ mutationFn: () => wipe(), onSuccess: () => qc.invalidateQueries() });

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Operations Console"
        subtitle="Real-time wireless intrusion telemetry"
        actions={
          isAdmin && (
            <>
              <button
                onClick={() => setDemoMode((v) => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition ${demoMode ? "bg-success/15 border-success/40 text-success" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {demoMode ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                Demo {demoMode ? "ON" : "OFF"}
                {demoMode && <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-success ml-1" />}
              </button>
              <button onClick={() => wipeMut.mutate()} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border text-muted-foreground hover:text-destructive transition">
                <Trash2 className="w-3.5 h-3.5" /> Reset
              </button>
            </>
          )
        }
      />

      {isAdmin && (
        <div className="glass rounded-xl p-3 mb-6 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-2 flex items-center gap-1.5"><Zap className="w-3 h-3" />Inject</span>
          {ATTACK_BUTTONS.map((b) => (
            <button key={b.type} onClick={() => injectMut.mutate(b.type)}
              className="px-3 py-1.5 rounded-md text-xs border border-border hover:border-primary/60 hover:bg-primary/10 transition">
              {b.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active threats" value={data?.activeThreats ?? "—"} accent={data && data.activeThreats > 0 ? "danger" : "ok"} hint="unacknowledged" />
        <StatCard label="Critical · 24h" value={data?.criticalLast24h ?? "—"} accent={data && data.criticalLast24h > 0 ? "danger" : "default"} />
        <StatCard label="Tracked APs" value={data?.apCount ?? "—"} hint={`${data?.rogueCount ?? 0} flagged rogue`} accent={data && data.rogueCount > 0 ? "warn" : "default"} />
        <StatCard label="Tracked clients" value={data?.clientCount ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Threat activity · 24h" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.timeline ?? []}>
                <CartesianGrid stroke="oklch(0.62 0.22 275 / 10%)" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: "oklch(0.68 0.04 260)", fontSize: 11 }} stroke="oklch(0.28 0.06 268)" />
                <YAxis tick={{ fill: "oklch(0.68 0.04 260)", fontSize: 11 }} stroke="oklch(0.28 0.06 268)" />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.06 268)", border: "1px solid oklch(0.62 0.22 275 / 30%)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="oklch(0.62 0.22 275)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="critical" stroke="oklch(0.62 0.24 25)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="high" stroke="oklch(0.75 0.18 65)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Threat distribution">
          <div className="h-64">
            {data && data.typeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.typeDistribution} dataKey="count" nameKey="type" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {data.typeDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.06 268)", border: "1px solid oklch(0.62 0.22 275 / 30%)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Channel utilization" className="lg:col-span-2">
          <div className="h-56">
            {data && data.channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.channelData}>
                  <CartesianGrid stroke="oklch(0.62 0.22 275 / 10%)" strokeDasharray="3 3" />
                  <XAxis dataKey="channel" tick={{ fill: "oklch(0.68 0.04 260)", fontSize: 11 }} stroke="oklch(0.28 0.06 268)" />
                  <YAxis tick={{ fill: "oklch(0.68 0.04 260)", fontSize: 11 }} stroke="oklch(0.28 0.06 268)" />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.06 268)", border: "1px solid oklch(0.62 0.22 275 / 30%)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="oklch(0.62 0.22 275)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </Card>
        <Card title="Live alert feed">
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {(data?.alerts ?? []).length === 0 && <EmptyChart label="No alerts yet" />}
            {(data?.alerts ?? []).map((a) => (
              <div key={a.id} className="p-2.5 rounded-md bg-surface-elevated/60 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <SeverityPill severity={a.severity} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(a.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs text-foreground/90 truncate" title={a.message}>{a.message}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {isLoading && <div className="text-xs text-muted-foreground mt-4">Loading telemetry…</div>}
    </div>
  );
}

function EmptyChart({ label = "No data yet — enable Demo mode or run an agent" }: { label?: string }) {
  return <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{label}</div>;
}
