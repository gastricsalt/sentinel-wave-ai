import { SeverityPill } from "./ui-kit";
import { STAGE_LABEL, type KillChainStage } from "@/lib/kill-chain";

export type ChainEvent = {
  id: string;
  sequence: number;
  stage: string;
  event_type: string;
  description: string;
  bssid: string | null;
  source_mac: string | null;
  occurred_at: string;
};

export function AttackTimeline({ events }: { events: ChainEvent[] }) {
  return (
    <ol className="relative border-l border-border ml-3">
      {events.map((e, i) => (
        <li key={e.id} className="ml-6 mb-5">
          <span className="absolute -left-[7px] mt-1.5 w-3.5 h-3.5 rounded-full border-2 border-primary bg-background" />
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] tabular-nums text-muted-foreground">#{e.sequence}</span>
            <span className="text-[10px] uppercase tracking-wider text-primary">{STAGE_LABEL[e.stage as KillChainStage] ?? e.stage}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{new Date(e.occurred_at).toLocaleTimeString()}</span>
          </div>
          <div className="text-sm text-foreground mb-1">{e.description}</div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground font-mono">
            {e.bssid && <span>BSSID: {e.bssid}</span>}
            {e.source_mac && <span>SRC: {e.source_mac}</span>}
            <span className="text-foreground/60">{e.event_type}</span>
          </div>
          {i === events.length - 1 && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-destructive">
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-destructive" /> latest event
            </div>
          )}
        </li>
      ))}
      {events.length === 0 && <li className="ml-6 text-sm text-muted-foreground">No chain events recorded yet.</li>}
    </ol>
  );
}
