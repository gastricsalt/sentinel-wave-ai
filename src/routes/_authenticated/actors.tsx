import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActors } from "@/lib/actors.functions";
import { PageHeader, Card } from "@/components/ui-kit";
import { Fingerprint } from "lucide-react";

export const Route = createFileRoute("/_authenticated/actors")({
  head: () => ({ meta: [{ title: "Threat Actors — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const list = useServerFn(listActors);
  const { data } = useQuery({ queryKey: ["actors"], queryFn: () => list() });
  const actors = data?.actors ?? [];
  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Threat Actor Profiles" subtitle="Behavioral clustering of recurring attackers" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actors.length === 0 && <Card><div className="text-sm text-muted-foreground">No actor profiles yet.</div></Card>}
        {actors.map((a) => (
          <Link key={a.id} to="/actors/$id" params={{ id: a.id }} className="block glass rounded-xl p-5 hover:border-primary/40 transition border border-transparent">
            <div className="flex items-center gap-2 mb-3">
              <Fingerprint className="w-4 h-4 text-primary" />
              <div className="font-medium tracking-tight">{a.label}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fingerprint</div>
            <div className="font-mono text-[11px] mb-3 truncate">{a.fingerprint}</div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div><div className="text-lg tabular-nums">{a.attack_count}</div><div className="text-[9px] uppercase text-muted-foreground">attacks</div></div>
              <div><div className="text-lg tabular-nums text-warning">{a.risk_score}</div><div className="text-[9px] uppercase text-muted-foreground">risk</div></div>
              <div><div className="text-lg tabular-nums">{a.preferred_types.length}</div><div className="text-[9px] uppercase text-muted-foreground">techniques</div></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.preferred_types.slice(0, 4).map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded text-[9px] border border-border text-muted-foreground">{t}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
