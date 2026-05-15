import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreats, listAccessPoints, listClients } from "@/lib/sentinel.functions";
import { PageHeader, Card } from "@/components/ui-kit";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — SentinelWave AI" }] }),
  component: Page,
});

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Page() {
  const t = useServerFn(listThreats);
  const a = useServerFn(listAccessPoints);
  const c = useServerFn(listClients);
  const threats = useQuery({ queryKey: ["rep-threats"], queryFn: () => t() });
  const aps = useQuery({ queryKey: ["rep-aps"], queryFn: () => a() });
  const clients = useQuery({ queryKey: ["rep-clients"], queryFn: () => c() });

  const Btn = ({ label, count, onClick }: { label: string; count: number; onClick: () => void }) => (
    <button onClick={onClick} className="glass rounded-xl p-5 text-left hover:border-primary/40 transition group">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{count}</div>
      <div className="text-xs text-primary mt-3 flex items-center gap-1.5 group-hover:gap-2 transition-all">
        <Download className="w-3.5 h-3.5" /> Export CSV
      </div>
    </button>
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Reports" subtitle="Export historical telemetry" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Btn label="Threats" count={threats.data?.length ?? 0}
          onClick={() => download(`threats-${Date.now()}.csv`, toCsv(threats.data ?? []))} />
        <Btn label="Access points" count={aps.data?.length ?? 0}
          onClick={() => download(`access-points-${Date.now()}.csv`, toCsv(aps.data ?? []))} />
        <Btn label="Clients" count={clients.data?.length ?? 0}
          onClick={() => download(`clients-${Date.now()}.csv`, toCsv(clients.data ?? []))} />
      </div>
      <Card title="Notes">
        <p className="text-sm text-muted-foreground">CSV exports include all fields and are suitable for ingestion into SIEM tools, Jupyter notebooks, or research datasets. PDF reports with charts and recommendations are planned in a follow-up.</p>
      </Card>
    </div>
  );
}
