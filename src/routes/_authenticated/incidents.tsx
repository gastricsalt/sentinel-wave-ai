import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { listIncidents, correlateIncidents } from "@/lib/incidents.functions";
import { PageHeader, Card, SeverityPill } from "@/components/ui-kit";
import { KillChainBar } from "@/components/KillChainBar";
import type { KillChainStage } from "@/lib/kill-chain";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/incidents")({
  head: () => ({ meta: [{ title: "Incidents — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const list = useServerFn(listIncidents);
  const correlate = useServerFn(correlateIncidents);
  const { data, refetch } = useQuery({ queryKey: ["incidents"], queryFn: () => list() });

  useEffect(() => { correlate().then(() => refetch()).catch(() => {}); }, [correlate, refetch]);

  const incidents = data?.incidents ?? [];

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Active Investigations" subtitle="Correlated multi-event security incidents"
        actions={<button onClick={() => correlate().then(() => refetch())} className="px-3 py-2 rounded-md text-sm border border-border hover:border-primary/60 transition flex items-center gap-2"><Activity className="w-3.5 h-3.5" />Re-correlate</button>}
      />
      <div className="space-y-3">
        {incidents.length === 0 && (
          <Card><div className="text-sm text-muted-foreground text-center py-8">No incidents yet. Run the Lab simulator or inject attacks to generate one.</div></Card>
        )}
        {incidents.map((inc) => (
          <Link key={inc.id} to="/incidents/$id" params={{ id: inc.id }}
            className="block glass rounded-xl p-5 hover:border-primary/40 transition border border-transparent">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityPill severity={inc.severity} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{inc.status}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{new Date(inc.last_event_at).toLocaleString()}</span>
                </div>
                <div className="font-medium tracking-tight truncate">{inc.title}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{inc.summary}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">affected</div>
                <div className="text-sm tabular-nums">{inc.affected_bssids.length}AP · {inc.affected_clients.length}C</div>
              </div>
            </div>
            <KillChainBar current={inc.current_stage as KillChainStage} />
          </Link>
        ))}
      </div>
    </div>
  );
}
