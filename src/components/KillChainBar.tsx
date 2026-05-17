import { STAGE_ORDER, STAGE_LABEL, type KillChainStage } from "@/lib/kill-chain";

export function KillChainBar({ current }: { current: KillChainStage }) {
  const currentIdx = STAGE_ORDER.indexOf(current);
  return (
    <div className="flex items-stretch gap-1.5">
      {STAGE_ORDER.map((stage, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={stage} className="flex-1 min-w-0">
            <div
              className={`h-1.5 rounded-full mb-1.5 transition ${
                reached ? (isCurrent ? "bg-destructive" : "bg-primary") : "bg-border"
              }`}
            />
            <div className={`text-[9px] uppercase tracking-wider truncate ${reached ? "text-foreground" : "text-muted-foreground"}`}>
              {STAGE_LABEL[stage]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
