import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActor } from "@/lib/actors.functions";
import { PageHeader, Card, SeverityPill } from "@/components/ui-kit";
import { ArrowLeft, Fingerprint } from "lucide-react";

export const Route = createFileRoute("/_authenticated/actors/$id")({
  head: () => ({ meta: [{ title: "Actor — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const get = useServerFn(getActor);
  const { data } = useQuery({ queryKey: ["actor", id], queryFn: () => get({ data: { id } }) });
  const a = data?.actor;
  if (!a) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="p-8 max-w-[1300px] mx-auto">
      <Link to="/actors" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="w-3 h-3" />Actors</Link>
      <PageHeader title={a.label} subtitle={`First seen ${new Date(a.first_seen).toLocaleString()} · last ${new Date(a.last_seen).toLocaleString()}`} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Behavioral fingerprint">
          <div className="flex items-center gap-2 mb-3"><Fingerprint className="w-4 h-4 text-primary" /><span className="font-mono text-xs">{a.fingerprint}</span></div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Preferred techniques</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {a.preferred_types.map((t) => <span key={t} className="px-2 py-0.5 rounded text-[10px] border border-primary/40 bg-primary/10">{t}</span>)}
          </div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Source MACs</div>
          <div className="space-y-0.5">
            {a.source_macs.map((m) => <div key={m} className="font-mono text-[11px]">{m}</div>)}
            {a.source_macs.length === 0 && <div className="text-xs text-muted-foreground">Unknown</div>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div><div className="text-2xl tabular-nums">{a.attack_count}</div><div className="text-[9px] uppercase text-muted-foreground">attacks</div></div>
            <div><div className="text-2xl tabular-nums text-warning">{a.risk_score}</div><div className="text-[9px] uppercase text-muted-foreground">risk score</div></div>
          </div>
        </Card>

        <Card title={`Incidents (${data?.incidents.length ?? 0})`} className="lg:col-span-2">
          <div className="space-y-2">
            {(data?.incidents ?? []).map((i) => (
              <Link key={i.id} to="/incidents/$id" params={{ id: i.id }} className="block p-3 rounded-md bg-surface-elevated/60 border border-border hover:border-primary/40 transition">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityPill severity={i.severity} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.current_stage}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground ml-auto">{new Date(i.last_event_at).toLocaleString()}</span>
                </div>
                <div className="text-sm">{i.title}</div>
              </Link>
            ))}
            {(data?.incidents ?? []).length === 0 && <div className="text-xs text-muted-foreground">No linked incidents.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
