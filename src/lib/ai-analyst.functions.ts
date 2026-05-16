import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { THREAT_KB, computeRiskScore, type ThreatType } from "./threat-knowledge";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

async function buildContext() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: threats }, { data: aps }, { count: clientCount }] = await Promise.all([
    supabaseAdmin.from("threats").select("type,severity,confidence,acknowledged,description,bssid,ssid,detected_at").gte("detected_at", since24h).order("detected_at", { ascending: false }).limit(40),
    supabaseAdmin.from("access_points").select("ssid,bssid,channel,encryption,is_rogue,vendor").limit(20),
    supabaseAdmin.from("clients").select("id", { count: "exact", head: true }),
  ]);
  const risk = computeRiskScore((threats ?? []).map((t) => ({ ...t, confidence: Number(t.confidence) })));
  const typeCounts: Record<string, number> = {};
  (threats ?? []).forEach((t) => { typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1; });

  return {
    risk,
    typeCounts,
    threats: threats ?? [],
    aps: aps ?? [],
    clientCount: clientCount ?? 0,
  };
}

function systemPrompt(ctx: Awaited<ReturnType<typeof buildContext>>) {
  const kb = Object.entries(THREAT_KB).map(([k, v]) =>
    `- ${k} (${v.label}, ${v.category}): ${v.summary} | Remediation: ${v.remediation.slice(0, 2).join("; ")}`
  ).join("\n");

  return `You are SentinelWave's senior wireless security analyst. You help SOC operators triage 802.11 threats.

Current environment snapshot (last 24h):
- Risk score: ${ctx.risk.score}/100 (${ctx.risk.rating})
- Tracked clients: ${ctx.clientCount}
- Threats by type: ${JSON.stringify(ctx.typeCounts)}
- Recent threats (latest 10):
${ctx.threats.slice(0, 10).map((t) => `  · [${t.severity}] ${t.type} — ${t.description} (BSSID: ${t.bssid ?? "n/a"}, conf: ${t.confidence}${t.acknowledged ? ", ack'd" : ""})`).join("\n") || "  · none"}
- Visible APs flagged rogue: ${ctx.aps.filter((a) => a.is_rogue).map((a) => `${a.ssid}/${a.bssid}`).join(", ") || "none"}

Threat knowledge base:
${kb}

Guidelines:
- Be concise, technical, and actionable. Use markdown with bullet lists and code spans for MACs/SSIDs.
- When asked for remediation, give numbered steps tied to the relevant standard (802.11w, WPA3, 802.1X, etc.).
- Cite the threat type in **bold** when referring to it.
- If the user asks something unrelated to wireless security, redirect them politely.
- Never invent threats that are not in the snapshot.`;
}

export const askAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const ctx = await buildContext();
    const messages = [
      { role: "system", content: systemPrompt(ctx) },
      ...data.messages,
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Lovable Cloud.");
      throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "(no response)";
    return { content, risk: ctx.risk };
  });

export const getReportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: threats }, { data: aps }, { data: clients }, { data: alerts }] = await Promise.all([
      supabaseAdmin.from("threats").select("*").gte("detected_at", since7d).order("detected_at", { ascending: false }),
      supabaseAdmin.from("access_points").select("*"),
      supabaseAdmin.from("clients").select("*"),
      supabaseAdmin.from("alerts").select("*").gte("created_at", since7d).order("created_at", { ascending: false }).limit(100),
    ]);

    const all = threats ?? [];
    const risk = computeRiskScore(all.map((t) => ({ ...t, confidence: Number(t.confidence) })));

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = { critical: 0, high: 0, warning: 0, info: 0 };
    all.forEach((t) => {
      byType[t.type] = (byType[t.type] ?? 0) + 1;
      bySeverity[t.severity] = (bySeverity[t.severity] ?? 0) + 1;
    });

    // Per-day timeline (last 7 days)
    const days: Array<{ day: string; count: number; critical: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      days.push({ day: label, count: 0, critical: 0 });
    }
    all.forEach((t) => {
      const d = new Date(t.detected_at);
      const idx = 6 - Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (idx >= 0 && idx < 7) {
        days[idx].count += 1;
        if (t.severity === "critical") days[idx].critical += 1;
      }
    });

    const activeFindings = (Object.keys(byType) as ThreatType[])
      .filter((t) => THREAT_KB[t])
      .map((t) => ({
        type: t,
        count: byType[t],
        kb: THREAT_KB[t],
      }))
      .sort((a, b) => b.kb.baseRiskScore - a.kb.baseRiskScore);

    return {
      generatedAt: new Date().toISOString(),
      windowDays: 7,
      risk,
      totals: {
        threats: all.length,
        aps: aps?.length ?? 0,
        rogueAps: (aps ?? []).filter((a) => a.is_rogue).length,
        clients: clients?.length ?? 0,
        criticalAlerts: (alerts ?? []).filter((a) => a.severity === "critical").length,
        unacknowledged: all.filter((t) => !t.acknowledged).length,
      },
      bySeverity,
      timeline: days,
      activeFindings,
      topThreats: all.slice(0, 20),
    };
  });
