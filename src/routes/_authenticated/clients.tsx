import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients } from "@/lib/sentinel.functions";
import { PageHeader, Card } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const fn = useServerFn(listClients);
  const { data } = useQuery({ queryKey: ["clients"], queryFn: () => fn(), refetchInterval: 8000 });
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Clients" subtitle={`${data?.length ?? 0} wireless devices observed`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">MAC</th>
                <th className="py-2 pr-4">Vendor</th>
                <th className="py-2 pr-4">Associated AP</th>
                <th className="py-2 pr-4">Packets</th>
                <th className="py-2 pr-4">RSSI</th>
                <th className="py-2 pr-4">Random MAC</th>
                <th className="py-2 pr-4">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface-elevated/40">
                  <td className="py-2 pr-4 font-mono text-xs">{c.mac}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{c.vendor ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{c.associated_bssid ?? "—"}</td>
                  <td className="py-2 pr-4 tabular-nums">{c.packets_seen}</td>
                  <td className="py-2 pr-4 tabular-nums">{c.signal_strength ?? "—"} dBm</td>
                  <td className="py-2 pr-4">{c.is_random_mac ? <span className="text-warning text-xs">yes</span> : <span className="text-muted-foreground text-xs">no</span>}</td>
                  <td className="py-2 pr-4 text-muted-foreground text-xs">{new Date(c.last_seen).toLocaleTimeString()}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No clients tracked yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
