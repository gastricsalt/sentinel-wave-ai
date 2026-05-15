import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreats, ackThreat, getMyRole } from "@/lib/sentinel.functions";
import { PageHeader, Card, SeverityPill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

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

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Threat feed" subtitle={`${data?.length ?? 0} detections`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
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
              {(data ?? []).map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-surface-elevated/40">
                  <td className="py-2 pr-4"><SeverityPill severity={t.severity} /></td>
                  <td className="py-2 pr-4 text-xs uppercase tracking-wider text-muted-foreground">{t.type}</td>
                  <td className="py-2 pr-4 max-w-md truncate" title={t.description}>{t.description}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{t.bssid ?? t.source_mac ?? "—"}</td>
                  <td className="py-2 pr-4 tabular-nums">{Number(t.confidence).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-muted-foreground text-xs">{new Date(t.detected_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">
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
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No threats detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
