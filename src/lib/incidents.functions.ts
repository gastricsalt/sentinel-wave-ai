import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { THREAT_TO_STAGE, STAGE_ORDER, type KillChainStage } from "./kill-chain";

const CORRELATION_WINDOW_MIN = 15;

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r) => r.role === "admin")) throw new Error("Admin only");
}

function fingerprintFor(threat: { source_mac: string | null; bssid: string | null; type: string }) {
  const id = threat.source_mac ?? threat.bssid ?? "unknown";
  const oui = id.split(":").slice(0, 3).join(":");
  return `${oui}|${threat.type.split("_")[0]}`;
}

/**
 * Correlate recent un-incidented threats into incidents.
 * Groups by BSSID/source_mac within the time window. Creates or extends an open incident.
 */
export const correlateIncidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const since = new Date(Date.now() - CORRELATION_WINDOW_MIN * 60 * 1000).toISOString();
    const { data: threats } = await supabaseAdmin
      .from("threats")
      .select("*")
      .is("incident_id", null)
      .gte("detected_at", since)
      .order("detected_at", { ascending: true });

    let createdOrTouched = 0;
    for (const t of threats ?? []) {
      const key = t.bssid ?? t.source_mac;
      if (!key) continue;

      // Find an open incident touching this BSSID/MAC
      const { data: open } = await supabaseAdmin
        .from("incidents")
        .select("id,affected_bssids,affected_clients,current_stage,severity")
        .in("status", ["open", "investigating"])
        .or(`affected_bssids.cs.{${key}},affected_clients.cs.{${key}}`)
        .limit(1)
        .maybeSingle();

      const stage: KillChainStage = THREAT_TO_STAGE[t.type] ?? "recon";
      let incidentId = open?.id;

      if (!incidentId) {
        const { data: created } = await supabaseAdmin
          .from("incidents")
          .insert({
            title: `Incident · ${t.type.replace(/_/g, " ")} · ${(t.bssid ?? t.source_mac ?? "").slice(0, 17)}`,
            summary: t.description,
            severity: t.severity,
            current_stage: stage,
            affected_bssids: t.bssid ? [t.bssid] : [],
            affected_clients: t.source_mac ? [t.source_mac] : [],
            started_at: t.detected_at,
            last_event_at: t.detected_at,
          })
          .select("id")
          .single();
        incidentId = created?.id;
      } else {
        // Advance stage to the later one
        const currIdx = STAGE_ORDER.indexOf(open!.current_stage as KillChainStage);
        const newIdx = STAGE_ORDER.indexOf(stage);
        const finalStage = newIdx > currIdx ? stage : (open!.current_stage as KillChainStage);
        const bssids = new Set([...(open!.affected_bssids ?? []), ...(t.bssid ? [t.bssid] : [])]);
        const clients = new Set([...(open!.affected_clients ?? []), ...(t.source_mac ? [t.source_mac] : [])]);
        await supabaseAdmin
          .from("incidents")
          .update({
            current_stage: finalStage,
            last_event_at: t.detected_at,
            affected_bssids: Array.from(bssids),
            affected_clients: Array.from(clients),
            severity: t.severity === "critical" ? "critical" : open!.severity,
          })
          .eq("id", incidentId);
      }

      if (!incidentId) continue;

      // Sequence number
      const { count } = await supabaseAdmin
        .from("attack_chain_events")
        .select("id", { count: "exact", head: true })
        .eq("incident_id", incidentId);

      await supabaseAdmin.from("attack_chain_events").insert({
        incident_id: incidentId,
        threat_id: t.id,
        sequence: (count ?? 0) + 1,
        stage,
        event_type: t.type,
        description: t.description,
        bssid: t.bssid,
        source_mac: t.source_mac,
        metadata: t.metadata,
        occurred_at: t.detected_at,
      });

      await supabaseAdmin.from("threats").update({ incident_id: incidentId }).eq("id", t.id);

      // Actor profiling
      const fp = fingerprintFor(t);
      const { data: actor } = await supabaseAdmin
        .from("threat_actors")
        .select("id,attack_count,preferred_types,source_macs,preferred_channels")
        .eq("fingerprint", fp)
        .maybeSingle();
      if (actor) {
        const types = new Set([...(actor.preferred_types ?? []), t.type]);
        const macs = new Set([...(actor.source_macs ?? []), ...(t.source_mac ? [t.source_mac] : [])]);
        await supabaseAdmin
          .from("threat_actors")
          .update({
            attack_count: actor.attack_count + 1,
            last_seen: t.detected_at,
            preferred_types: Array.from(types),
            source_macs: Array.from(macs),
          })
          .eq("id", actor.id);
        await supabaseAdmin.from("threats").update({ actor_id: actor.id }).eq("id", t.id);
        await supabaseAdmin.from("incidents").update({ actor_id: actor.id }).eq("id", incidentId);
      } else {
        const { data: newActor } = await supabaseAdmin
          .from("threat_actors")
          .insert({
            fingerprint: fp,
            label: `Actor ${fp.slice(0, 12)}`,
            attack_count: 1,
            preferred_types: [t.type],
            source_macs: t.source_mac ? [t.source_mac] : [],
            risk_score: t.severity === "critical" ? 85 : 60,
          })
          .select("id")
          .single();
        if (newActor) {
          await supabaseAdmin.from("threats").update({ actor_id: newActor.id }).eq("id", t.id);
          await supabaseAdmin.from("incidents").update({ actor_id: newActor.id }).eq("id", incidentId);
        }
      }

      createdOrTouched++;
    }
    return { processed: createdOrTouched };
  });

export const listIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("incidents")
      .select("*")
      .order("last_event_at", { ascending: false })
      .limit(100);
    return { incidents: data ?? [] };
  });

export const getIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const [{ data: incident }, { data: events }, { data: threats }] = await Promise.all([
      supabaseAdmin.from("incidents").select("*, threat_actors(*)").eq("id", data.id).single(),
      supabaseAdmin.from("attack_chain_events").select("*").eq("incident_id", data.id).order("sequence"),
      supabaseAdmin.from("threats").select("*").eq("incident_id", data.id).order("detected_at"),
    ]);
    return { incident, events: events ?? [], threats: threats ?? [] };
  });

export const updateIncidentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "investigating", "contained", "closed"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const patch: { status: typeof data.status; closed_at?: string } = { status: data.status };
    if (data.status === "closed" || data.status === "contained") patch.closed_at = new Date().toISOString();
    await supabaseAdmin.from("incidents").update(patch).eq("id", data.id);
    return { ok: true };
  });

export const explainIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");
    const { data: incident } = await supabaseAdmin.from("incidents").select("*").eq("id", data.id).single();
    const { data: events } = await supabaseAdmin
      .from("attack_chain_events").select("*").eq("incident_id", data.id).order("sequence");

    const prompt = `Produce a concise forensic narrative (markdown, ~200 words) for this wireless incident.
Incident: ${JSON.stringify(incident)}
Chain events: ${JSON.stringify(events)}
Include: what happened, attacker technique, impact, recommended immediate containment steps.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a wireless SOC forensic analyst. Write tight, factual incident narratives." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const narrative = json.choices?.[0]?.message?.content ?? "(no narrative)";
    await supabaseAdmin.from("incidents").update({ ai_narrative: narrative }).eq("id", data.id);
    return { narrative };
  });
