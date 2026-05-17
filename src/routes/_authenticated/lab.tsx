import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runScriptedChain } from "@/lib/scripted-attack.functions";
import { correlateIncidents } from "@/lib/incidents.functions";
import { PageHeader, Card } from "@/components/ui-kit";
import { AlertTriangle, FlaskConical, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lab")({
  head: () => ({ meta: [{ title: "Purple Team Lab — SentinelWave AI" }] }),
  component: Page,
});

const SCENARIOS = [
  { id: "evil_twin_campaign" as const, name: "Evil Twin Campaign", desc: "Full 5-stage chain: recon → MAC spoof → deauth → rogue AP → victim reassociation. Best for end-to-end reconstruction demos." },
  { id: "deauth_to_pmkid" as const, name: "Deauth → PMKID Capture", desc: "3-stage credential-harvesting chain. Tests offline-crack defenses." },
  { id: "rogue_recon" as const, name: "Rogue Reconnaissance", desc: "Lightweight 2-stage flagging exercise. Verifies basic alerting." },
];

function Page() {
  const qc = useQueryClient();
  const run = useServerFn(runScriptedChain);
  const correlate = useServerFn(correlateIncidents);
  const [ack, setAck] = useState(false);
  const [lastResult, setLastResult] = useState<{ scenario: string; steps: number } | null>(null);

  const mut = useMutation({
    mutationFn: async (scenario: typeof SCENARIOS[number]["id"]) => {
      const r = await run({ data: { scenario } });
      await correlate();
      return r;
    },
    onSuccess: (r) => {
      setLastResult({ scenario: r.scenario, steps: r.steps });
      qc.invalidateQueries();
    },
  });

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <PageHeader title="Purple Team Lab" subtitle="Reproducible attack-chain simulation for detection validation"
        actions={<span className="flex items-center gap-1.5 text-xs text-warning"><FlaskConical className="w-3.5 h-3.5" />LAB MODE</span>}
      />

      <Card className="mb-5 border-warning/40">
        <div className="flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">Authorized defensive testing only</div>
            <div className="text-xs text-muted-foreground mb-3">
              These scenarios insert <strong>synthetic detection events into the database only</strong>. No wireless frames are transmitted, no devices are deauthenticated, and no real networks are touched. Use exclusively for validating that your SOC pipeline correctly correlates, classifies, and responds to wireless attacks.
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="rounded" />
              I acknowledge this is an authorized, isolated test environment.
            </label>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SCENARIOS.map((s) => (
          <Card key={s.id} title={s.name}>
            <p className="text-xs text-muted-foreground mb-4 min-h-[60px]">{s.desc}</p>
            <button onClick={() => mut.mutate(s.id)} disabled={!ack || mut.isPending}
              className="w-full px-3 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-30"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}>
              <Play className="w-3.5 h-3.5" />Run scenario
            </button>
          </Card>
        ))}
      </div>

      {lastResult && (
        <Card className="mt-5">
          <div className="text-sm text-success">✓ Executed <strong>{lastResult.scenario}</strong> — {lastResult.steps} chain events ingested and correlated.</div>
          <div className="text-xs text-muted-foreground mt-1">Check the Incidents page to view the reconstruction.</div>
        </Card>
      )}
    </div>
  );
}
