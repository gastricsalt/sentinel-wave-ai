import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/sentinel.functions";
import { listIncidents } from "@/lib/incidents.functions";
import { predictNextAttack } from "@/lib/prediction.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, Card, SeverityPill } from "@/components/ui-kit";
import { KillChainBar } from "@/components/KillChainBar";
import type { KillChainStage } from "@/lib/kill-chain";
import { STAGE_LABEL } from "@/lib/kill-chain";
import { Brain, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/soc")({
  head: () => ({ meta: [{ title: "SOC Console — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const stats = useServerFn(getDashboardStats);
  const incs = useServerFn(listIncidents);
  const pred = useServerFn(predictNextAttack);

  const sQ = useQuery({ queryKey: ["soc-stats"], queryFn: () => stats(), refetchInterval: 8000 });
  const iQ = useQuery({ queryKey: ["soc-incs"], queryFn: () => incs(), refetchInterval: 8000 });
  const pQ = useQuery({ queryKey: ["soc-pred"], queryFn: () => pred(), refetchInterval: 30000 });

  useEffect(() => {
    const ch = supabase.channel("soc-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "threats" }, () => qc.invalidateQueries())
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => qc.invalidateQueries())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const open = (iQ.data?.incidents ?? []).filter((i) => i.status !== "closed").slice(0, 5);
  const p = pQ.data?.predicted;

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <PageHeader title="SOC Operations" subtitle="Wall-display ready unified threat console"
        actions={<span className="flex items-center gap-1.5 text-xs text-success"><span className="pulse-dot w-1.5 h-1.5 rounded-full bg-success" />LIVE</span>}
      />

      {p && (
        <div className="glass rounded-xl p-4 mb-5 border-l-4 border-warning flex items-center gap-4">
          <Brain className="w-6 h-6 text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-warning mb-0.5">AI Attack Prediction</div>
            <div className="text-sm">Likely next: <strong>{p.type}</strong> in stage <strong>{STAGE_LABEL[p.stage]}</strong> within ~{p.eta_minutes} min</div>
            <div className="text-xs text-muted-foreground mt-0.5">{p.rationale}</div>
          </div>
          <div className="text-center shrink-0">
            <div className="text-2xl font-semibold tabular-nums text-warning">{Math.round(p.confidence * 100)}%</div>
            <div className="text-[9px] uppercase text-muted-foreground">confidence</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="Active threats" value={sQ.data?.activeThreats ?? "—"} accent="danger" />
        <StatCard label="Critical 24h" value={sQ.data?.criticalLast24h ?? "—"} accent="danger" />
        <StatCard label="Open incidents" value={open.length} accent={open.length > 0 ? "warn" : "ok"} />
        <StatCard label="Rogue APs" value={sQ.data?.rogueCount ?? 0} accent="warn" />
        <StatCard label="Clients" value={sQ.data?.clientCount ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card title="Open investigations" action={<Link to="/incidents" className="text-xs text-primary">All →</Link>}>
          <div className="space-y-3">
            {open.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">No open incidents.</div>}
            {open.map((i) => (
              <Link key={i.id} to="/incidents/$id" params={{ id: i.id }} className="block p-3 rounded-md bg-surface-elevated/60 border border-border hover:border-primary/40">
                <div className="flex items-center gap-2 mb-2">
                  <SeverityPill severity={i.severity} />
                  <span className="text-xs flex-1 truncate">{i.title}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{new Date(i.last_event_at).toLocaleTimeString()}</span>
                </div>
                <KillChainBar current={i.current_stage as KillChainStage} />
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Live alert feed" action={<span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Radio className="w-3 h-3" />realtime</span>}>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {(sQ.data?.alerts ?? []).map((a) => (
              <div key={a.id} className="p-2 rounded-md bg-surface-elevated/60 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <SeverityPill severity={a.severity} />
                  <span className="text-[10px] tabular-nums text-muted-foreground">{new Date(a.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="text-xs">{a.message}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
