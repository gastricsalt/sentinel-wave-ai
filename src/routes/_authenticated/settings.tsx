import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/sentinel.functions";
import { PageHeader, Card } from "@/components/ui-kit";
import { Download, Terminal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SentinelWave AI" }] }),
  component: Page,
});

function Page() {
  const role = useServerFn(getMyRole);
  const { data } = useQuery({ queryKey: ["my-role"], queryFn: () => role() });
  const ingestUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/ingest` : "/api/public/ingest";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="Sensor wiring and downloads" />

      <Card title="Your role" className="mb-4">
        <div className="text-sm">
          {data?.isAdmin ? (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 text-xs font-medium uppercase tracking-wider">Admin</span>
          ) : (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border text-xs font-medium uppercase tracking-wider">Analyst</span>
          )}
          <p className="text-xs text-muted-foreground mt-3">The first user to register becomes admin automatically. Admins can acknowledge threats, run the simulator, and inject test attacks.</p>
        </div>
      </Card>

      <Card title="Sensor ingest endpoint" className="mb-4">
        <p className="text-sm text-muted-foreground mb-3">Configure your Python agent (or any sensor) to POST detections to this endpoint. Requests must include an HMAC-SHA256 signature in the <code className="font-mono text-foreground">x-sentinel-signature</code> header.</p>
        <div className="bg-input border border-border rounded-md p-3 font-mono text-xs break-all">{ingestUrl}</div>
        <p className="text-xs text-muted-foreground mt-2">Shared secret env var on the agent side: <code className="font-mono text-foreground">SENTINEL_HMAC_SECRET</code> — must match the server-side <code className="font-mono text-foreground">INGEST_HMAC_SECRET</code> stored in your Cloud secrets.</p>
      </Card>

      <Card title="Python agent" className="mb-4">
        <p className="text-sm text-muted-foreground mb-4 flex items-start gap-2">
          <Terminal className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <span>Run this on a Linux box (Kali / Ubuntu / Debian) with a USB Wi-Fi adapter capable of monitor mode. The agent captures 802.11 frames with Scapy, runs rule-based detection, and POSTs batched results to your ingest endpoint.</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/agent/sentinelwave-agent.py" download className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:border-primary hover:bg-primary/10 transition">
            <Download className="w-4 h-4" /> sentinelwave-agent.py
          </a>
          <a href="/agent/sentinelwave-nmap.py" download className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:border-primary hover:bg-primary/10 transition">
            <Download className="w-4 h-4" /> sentinelwave-nmap.py
          </a>
          <a href="/agent/README.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:border-primary hover:bg-primary/10 transition">
            <Download className="w-4 h-4" /> README.md
          </a>
          <a href="/agent/requirements.txt" download className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:border-primary hover:bg-primary/10 transition">
            <Download className="w-4 h-4" /> requirements.txt
          </a>
        </div>
      </Card>

      <Card title="Quickstart">
        <pre className="bg-input border border-border rounded-md p-3 text-xs font-mono overflow-x-auto">{`sudo apt install -y aircrack-ng
pip install -r requirements.txt
sudo SENTINEL_HMAC_SECRET=<your-secret> \\
  python3 sentinelwave-agent.py \\
  --iface wlan0 \\
  --url ${ingestUrl} \\
  --sensor-id sensor-01`}</pre>
      </Card>
    </div>
  );
}
