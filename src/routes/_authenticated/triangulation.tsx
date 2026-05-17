import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { triangulate, seedRssi, listTrackedBssids } from "@/lib/triangulation.functions";
import { PageHeader, Card } from "@/components/ui-kit";
import { FloorPlan } from "@/components/FloorPlan";
import { Radar, Crosshair } from "lucide-react";

export const Route = createFileRoute("/_authenticated/triangulation")({
  head: () => ({ meta: [{ title: "Triangulation — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const tri = useServerFn(triangulate);
  const seed = useServerFn(seedRssi);
  const tracked = useServerFn(listTrackedBssids);
  const [bssid, setBssid] = useState("");
  const trackedQ = useQuery({ queryKey: ["tracked-bssids"], queryFn: () => tracked() });
  const triQ = useQuery({
    queryKey: ["triangulate", bssid],
    queryFn: () => tri({ data: { bssid } }),
    enabled: bssid.length > 0,
    refetchInterval: 5000,
  });
  const seedMut = useMutation({
    mutationFn: () => seed({ data: { bssid } }),
    onSuccess: () => { triQ.refetch(); trackedQ.refetch(); },
  });

  return (
    <div className="p-8 max-w-[1300px] mx-auto">
      <PageHeader
        title="Source Triangulation"
        subtitle="Multi-sensor RSSI-based rogue device localization"
        actions={<span className="flex items-center gap-1.5 text-xs text-primary"><Radar className="w-3.5 h-3.5" />Log-distance path-loss · weighted centroid</span>}
      />

      <Card className="mb-5">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Target BSSID</label>
            <input value={bssid} onChange={(e) => setBssid(e.target.value)} placeholder="aa:bb:cc:dd:ee:ff"
              className="w-full mt-1 bg-input border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" />
          </div>
          <button onClick={() => seedMut.mutate()} disabled={!bssid || seedMut.isPending}
            className="px-4 py-2 rounded-md text-sm border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-40">
            <Crosshair className="w-3.5 h-3.5 inline mr-1" /> Inject sensor sample
          </button>
        </div>
        {(trackedQ.data?.bssids ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recently tracked:</span>
            {trackedQ.data!.bssids.slice(0, 6).map((b) => (
              <button key={b} onClick={() => setBssid(b)} className="px-2 py-0.5 rounded text-[10px] border border-border hover:border-primary/60 font-mono">{b}</button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Floor plan" className="lg:col-span-2">
          {triQ.data ? (
            <FloorPlan sensors={triQ.data.sensors} estimate={triQ.data.estimate} />
          ) : (
            <div className="text-sm text-muted-foreground text-center py-12">Enter a BSSID and inject samples to begin triangulation.</div>
          )}
        </Card>

        <Card title="Sensor readings">
          <div className="space-y-2">
            {(triQ.data?.samples ?? []).map((s, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="font-mono text-muted-foreground">sensor {i + 1}</span>
                <span className="tabular-nums">{s.rssi} dBm</span>
              </div>
            ))}
            {triQ.data?.estimate && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimate</div>
                <div className="text-sm tabular-nums">({triQ.data.estimate.x.toFixed(1)}m, {triQ.data.estimate.y.toFixed(1)}m)</div>
                <div className="text-xs text-warning">Confidence: {Math.round(triQ.data.estimate.confidence * 100)}%</div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
