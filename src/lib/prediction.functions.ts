import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { THREAT_TO_STAGE, STAGE_ORDER, type KillChainStage, STAGE_LABEL } from "./kill-chain";

// Simple Markov-style prediction: given the most recent stage in the last hour,
// predict the next likely attack type based on historical chain transitions.
export const predictNextAttack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("threats").select("type,severity,detected_at").gte("detected_at", since).order("detected_at", { ascending: false }).limit(20);

    if (!recent || recent.length === 0) {
      return {
        predicted: null as null | { type: string; stage: KillChainStage; eta_minutes: number; confidence: number; rationale: string },
        recentCount: 0,
      };
    }

    const latestStage = (THREAT_TO_STAGE[recent[0].type] ?? "recon") as KillChainStage;
    const idx = STAGE_ORDER.indexOf(latestStage);
    const nextStage = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : latestStage;

    // Find most common attack type historically at nextStage
    const { data: hist } = await supabaseAdmin.from("threats").select("type").limit(500);
    const counts: Record<string, number> = {};
    for (const h of hist ?? []) {
      if ((THREAT_TO_STAGE[h.type] ?? "recon") === nextStage) {
        counts[h.type] = (counts[h.type] ?? 0) + 1;
      }
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const predictedType = top?.[0] ?? Object.keys(THREAT_TO_STAGE).find((k) => THREAT_TO_STAGE[k] === nextStage) ?? "evil_twin";

    const burst = recent.filter((r) => Date.now() - new Date(r.detected_at).getTime() < 10 * 60 * 1000).length;
    const confidence = Math.min(0.95, 0.4 + burst * 0.08 + (top ? 0.15 : 0));

    return {
      predicted: {
        type: predictedType,
        stage: nextStage,
        eta_minutes: Math.max(2, 30 - burst * 3),
        confidence: Number(confidence.toFixed(2)),
        rationale: `Latest activity is in ${STAGE_LABEL[latestStage]} (${recent[0].type}). ${burst} events in last 10m. Historical chain pattern suggests ${STAGE_LABEL[nextStage]}.`,
      },
      recentCount: recent.length,
    };
  });
