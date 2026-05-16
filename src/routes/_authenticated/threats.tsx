import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreats, ackThreat, getMyRole } from "@/lib/sentinel.functions";
import { PageHeader, Card, SeverityPill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronDown, ChevronRight, ShieldAlert, BookOpen } from "lucide-react";
import { THREAT_KB, type ThreatType } from "@/lib/threat-knowledge";

export const Route = createFileRoute("/_authenticated/threats")({
  head: () => ({ meta: [{ title: "Threats — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const fn = useServerFn(listThreats);
  const ack = useServerFn(ackThreat);
  const role = useServerFn(getMyRole);
  const { data } = useQuery({ queryKey: ["threats"], queryFn: () => fn() });
  const { data: roleData } = useQuery({ queryKey: ["my-role"], queryFn: () => role() });
  const isAdmin = roleData?.isAdmin ?? false;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "open" | "critical">("all");

  useEffect(() => {
    const ch = supabase
      .channel("realtime-threats")
      .on("postgres_changes", { event: "*", schema: "public", table: "threats" }, () => {
        qc.invalidateQueries({ queryKey: ["threats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const ackMut = useMutation({
    mutationFn: (id: string) => ack({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threats"] }),
  });

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const filtered = (data ?? []).filter((t) => {
    if (filter === "open") return !t.acknowledged;
    if (filter === "critical") return t.severity === "critical";
    return true;
  });

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Threat feed"
        subtitle={`${filtered.length} of ${data?.length ?? 0} detections · click a row for remediation`}
        actions={
          <div className="flex items-center gap-1 text-xs">
            {(["all", "open", "critical"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md border transition uppercase tracking-wider ${filter === f ? "border-primary/60 bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>
        }
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="py-2 pr-2 w-6"></th>
                <th className="py-2 pr-4">Severity</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">BSSID / Source</th>
                <th className="py-2 pr-4">Conf</th>
                <th className="py-2 pr-4">Detected</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const kb = THREAT_KB[t.type as ThreatType];
                const isOpen = expanded.has(t.id);
                return (
                  <>
                    <tr key={t.id} className="border-b border-border/50 hover:bg-surface-elevated/40 cursor-pointer" onClick={() => toggle(t.id)}>
                      <td className="py-2 pl-1">{isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}</td>
                      <td className="py-2 pr-4"><SeverityPill severity={t.severity} /></td>
                      <td className="py-2 pr-4 text-xs uppercase tracking-wider text-muted-foreground">{t.type}</td>
                      <td className="py-2 pr-4 max-w-md truncate" title={t.description}>{t.description}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{t.bssid ?? t.source_mac ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums">{Number(t.confidence).toFixed(2)}</td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{new Date(t.detected_at).toLocaleString()}</td>
                      <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                        {t.acknowledged ? (
                          <span className="text-success text-xs flex items-center gap-1"><Check className="w-3 h-3" /> ack'd</span>
                        ) : isAdmin ? (
                          <button onClick={() => ackMut.mutate(t.id)} className="text-xs px-2 py-1 rounded border border-border hover:border-primary hover:bg-primary/10 transition">
                            Acknowledge
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">open</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && kb && (
                      <tr className="bg-surface-elevated/30 border-b border-border/50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid md:grid-cols-3 gap-5">
                            <div className="md:col-span-1">
                              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5"><ShieldAlert className="w-3 h-3" /> {kb.label}</div>
                              <p className="text-xs text-foreground/90 mb-3">{kb.summary}</p>
                              <p className="text-xs"><span className="text-muted-foreground">Risk:</span> {kb.risk}</p>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Indicators</div>
                              <ul className="space-y-1 text-xs list-disc pl-4 text-foreground/85">
                                {kb.indicators.map((i) => <li key={i}>{i}</li>)}
                              </ul>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Remediation</div>
                              <ol className="space-y-1 text-xs list-decimal pl-4 text-foreground/85">
                                {kb.remediation.map((r) => <li key={r}>{r}</li>)}
                              </ol>
                            </div>
                          </div>
                          {kb.references.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <BookOpen className="w-3 h-3" /> {kb.references.map((r, i) => (
                                <span key={r.url}>{i > 0 && " · "}<a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{r.label}</a></span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">No threats match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
