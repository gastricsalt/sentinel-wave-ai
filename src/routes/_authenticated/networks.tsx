import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccessPoints } from "@/lib/sentinel.functions";
import { PageHeader, Card } from "@/components/ui-kit";
import { useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/networks")({
  head: () => ({ meta: [{ title: "Networks — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const fn = useServerFn(listAccessPoints);
  const { data } = useQuery({ queryKey: ["aps"], queryFn: () => fn(), refetchInterval: 8000 });
  const [q, setQ] = useState("");
  const filtered = (data ?? []).filter((a) =>
    !q || `${a.ssid ?? ""} ${a.bssid} ${a.vendor ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Networks" subtitle={`${filtered.length} access points tracked`} />
      <Card>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter SSID, BSSID, vendor…"
            className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">SSID</th>
                <th className="py-2 pr-4">BSSID</th>
                <th className="py-2 pr-4">Ch</th>
                <th className="py-2 pr-4">Enc</th>
                <th className="py-2 pr-4">Vendor</th>
                <th className="py-2 pr-4">RSSI</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-surface-elevated/40">
                  <td className="py-2 pr-4">{a.ssid || <span className="text-muted-foreground italic">‹hidden›</span>}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{a.bssid}</td>
                  <td className="py-2 pr-4 tabular-nums">{a.channel ?? "—"}</td>
                  <td className="py-2 pr-4">{a.encryption ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{a.vendor ?? "—"}</td>
                  <td className="py-2 pr-4 tabular-nums">{a.signal_strength ?? "—"} dBm</td>
                  <td className="py-2 pr-4">
                    {a.is_rogue
                      ? <span className="text-destructive text-xs font-medium">ROGUE</span>
                      : <span className="text-success text-xs">clean</span>}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground text-xs">{new Date(a.last_seen).toLocaleTimeString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">No networks tracked yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
