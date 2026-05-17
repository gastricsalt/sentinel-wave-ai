import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIncident, updateIncidentStatus, explainIncident } from "@/lib/incidents.functions";
import { PageHeader, Card, SeverityPill } from "@/components/ui-kit";
import { KillChainBar } from "@/components/KillChainBar";
import { AttackTimeline } from "@/components/AttackTimeline";
import { THREAT_KB, type ThreatType } from "@/lib/threat-knowledge";
import type { KillChainStage } from "@/lib/kill-chain";
import { STAGE_LABEL, nextLikelyStage } from "@/lib/kill-chain";
import ReactMarkdown from "react-markdown";
import { ShieldCheck, Sparkles, ArrowLeft, Users, Wifi } from "lucide-react";

export const Route = createFileRoute("/_authenticated/incidents/$id")({
  head: () => ({ meta: [{ title: "Incident — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const get = useServerFn(getIncident);
  const update = useServerFn(updateIncidentStatus);
  const explain = useServerFn(explainIncident);

  const q = useQuery({ queryKey: ["incident", id], queryFn: () => get({ data: { id } }) });
  const statusMut = useMutation({
    mutationFn: (status: "investigating" | "contained" | "closed") => update({ data: { id, status } }),
    onSuccess: () => q.refetch(),
  });
  const explainMut = useMutation({ mutationFn: () => explain({ data: { id } }), onSuccess: () => q.refetch() });

  const inc = q.data?.incident;
  const events = q.data?.events ?? [];
  const threatTypes = Array.from(new Set(events.map((e) => e.event_type))) as ThreatType[];
  const nextStage = inc ? nextLikelyStage(inc.current_stage as KillChainStage) : null;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <Link to="/incidents" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="w-3 h-3" />All incidents</Link>
      {!inc ? (
        <div className="text-sm text-muted-foreground">Loading incident…</div>
      ) : (
        <>
          <PageHeader
            title={inc.title}
            subtitle={`Started ${new Date(inc.started_at).toLocaleString()} · ${events.length} chain events`}
            actions={
              <div className="flex gap-2">
                <SeverityPill severity={inc.severity} />
                <button onClick={() => statusMut.mutate("investigating")} className="px-2.5 py-1 rounded-md text-xs border border-border hover:border-primary/60">Investigating</button>
                <button onClick={() => statusMut.mutate("contained")} className="px-2.5 py-1 rounded-md text-xs border border-success/40 text-success hover:bg-success/10">Mark contained</button>
                <button onClick={() => statusMut.mutate("closed")} className="px-2.5 py-1 rounded-md text-xs border border-border hover:border-primary/60">Close</button>
              </div>
            }
          />

          <Card className="mb-5">
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Kill Chain · current: {STAGE_LABEL[inc.current_stage as KillChainStage]}</div>
              <KillChainBar current={inc.current_stage as KillChainStage} />
              {nextStage && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="text-warning">Predicted next stage:</span> {STAGE_LABEL[nextStage]}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div><div className="text-sm">{inc.status}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Wifi className="w-3 h-3" />APs</div><div className="text-sm tabular-nums">{inc.affected_bssids.length}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Clients</div><div className="text-sm tabular-nums">{inc.affected_clients.length}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last event</div><div className="text-sm">{new Date(inc.last_event_at).toLocaleTimeString()}</div></div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card title="Attack reconstruction" className="lg:col-span-2">
              <AttackTimeline events={events} />
            </Card>

            <div className="space-y-5">
              <Card title="AI Forensic narrative" action={
                <button onClick={() => explainMut.mutate()} disabled={explainMut.isPending}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50">
                  <Sparkles className="w-3 h-3" />{explainMut.isPending ? "Generating…" : (inc.ai_narrative ? "Regenerate" : "Generate")}
                </button>
              }>
                {inc.ai_narrative ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5">
                    <ReactMarkdown>{inc.ai_narrative}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Click Generate for an AI-written incident summary.</div>
                )}
              </Card>

              <Card title="Response playbook">
                <div className="space-y-3">
                  {threatTypes.map((tp) => {
                    const kb = THREAT_KB[tp];
                    if (!kb) return null;
                    return (
                      <div key={tp} className="border-l-2 border-primary/40 pl-3">
                        <div className="text-xs font-medium flex items-center gap-2"><ShieldCheck className="w-3 h-3 text-primary" />{kb.label}</div>
                        <ol className="mt-1 space-y-0.5 text-[11px] text-muted-foreground list-decimal list-inside">
                          {kb.remediation.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                        </ol>
                      </div>
                    );
                  })}
                  {threatTypes.length === 0 && <div className="text-xs text-muted-foreground">No playbook entries.</div>}
                </div>
              </Card>

              <Card title="Affected assets">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">BSSIDs</div>
                  {inc.affected_bssids.map((b) => <div key={b} className="font-mono text-[11px]">{b}</div>)}
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">Client MACs</div>
                  {inc.affected_clients.map((c) => <div key={c} className="font-mono text-[11px]">{c}</div>)}
                  {inc.affected_bssids.length === 0 && inc.affected_clients.length === 0 && <div className="text-xs text-muted-foreground">None</div>}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
