import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VENDORS = ["Cisco", "TP-Link", "Netgear", "Ubiquiti"];
const ENC = ["WPA3", "WPA2", "OPEN"];
function randMac() { return Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(":"); }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function rint(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r) => r.role === "admin")) throw new Error("Admin only");
}

/**
 * Scripted multi-stage attack chain — simulates a realistic Evil Twin campaign
 * suitable for reconstruction + kill-chain demos.
 * SAFE: Only inserts synthetic detection rows into the database. Does NOT
 * transmit any wireless frames or interact with real networks.
 */
export const runScriptedChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    scenario: z.enum(["evil_twin_campaign", "deauth_to_pmkid", "rogue_recon"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const target_ssid = pick(["CorpNet", "Office-WiFi", "Boardroom-5G"]);
    const attacker_mac = randMac();
    const rogue_bssid = randMac();
    const victim_mac = randMac();
    const now = Date.now();
    const sec = (s: number) => new Date(now - (90 - s) * 1000).toISOString();

    type Step = { type: string; description: string; severity: "warning" | "high" | "critical"; bssid?: string; source_mac?: string; ssid?: string; offset: number; meta: Record<string, unknown> };
    let steps: Step[] = [];

    if (data.scenario === "evil_twin_campaign") {
      steps = [
        { type: "beacon_flood", description: `Reconnaissance: ${rint(60, 120)} fake beacons probing client preferences`, severity: "warning", source_mac: attacker_mac, offset: 0, meta: { stage: "recon" } },
        { type: "mac_spoof", description: `Attacker MAC randomization detected — vendor OUI inconsistency`, severity: "warning", source_mac: attacker_mac, offset: 10, meta: { stage: "weaponization" } },
        { type: "deauth_flood", description: `Burst of ${rint(150, 300)} deauth frames targeting ${target_ssid} clients`, severity: "critical", source_mac: attacker_mac, bssid: rogue_bssid, offset: 25, meta: { stage: "exploitation", targets: 4 } },
        { type: "evil_twin", description: `Rogue AP advertising ${target_ssid} with downgraded encryption`, severity: "critical", ssid: target_ssid, bssid: rogue_bssid, offset: 45, meta: { stage: "installation" } },
        { type: "pmkid_capture", description: `Victim ${victim_mac.slice(0, 8)}.. reassociated to rogue AP — EAPOL capture observed`, severity: "critical", bssid: rogue_bssid, source_mac: victim_mac, offset: 70, meta: { stage: "actions" } },
      ];
    } else if (data.scenario === "deauth_to_pmkid") {
      steps = [
        { type: "anomaly", description: `Unusual probe-request rate from ${attacker_mac}`, severity: "warning", source_mac: attacker_mac, offset: 0, meta: {} },
        { type: "deauth_flood", description: `${rint(100, 220)} deauth frames in 5s`, severity: "critical", source_mac: attacker_mac, offset: 20, meta: {} },
        { type: "pmkid_capture", description: `Single EAPOL M1 captured — offline PSK cracking likely`, severity: "critical", bssid: randMac(), source_mac: attacker_mac, offset: 50, meta: { tool: "hcxdumptool" } },
      ];
    } else {
      steps = [
        { type: "beacon_flood", description: `Beacon flood reconnaissance`, severity: "warning", source_mac: attacker_mac, offset: 0, meta: {} },
        { type: "rogue_ap", description: `Unauthorized AP appeared on managed channel`, severity: "high", bssid: rogue_bssid, ssid: target_ssid, offset: 30, meta: {} },
      ];
    }

    const threatIds: string[] = [];
    for (const s of steps) {
      const { data: t } = await supabaseAdmin.from("threats").insert({
        type: s.type,
        severity: s.severity,
        confidence: 0.88,
        bssid: s.bssid ?? null,
        ssid: s.ssid ?? null,
        source_mac: s.source_mac ?? null,
        description: s.description,
        detected_at: sec(s.offset),
        metadata: { ...s.meta, scripted: true, scenario: data.scenario } as never,
      }).select("id").single();
      if (t) threatIds.push(t.id);
      await supabaseAdmin.from("alerts").insert({
        message: `[${s.type.toUpperCase()}] ${s.description}`,
        severity: s.severity,
        threat_id: t?.id,
        created_at: sec(s.offset),
      });
      if (s.type === "evil_twin" || s.type === "rogue_ap") {
        if (s.bssid) {
          await supabaseAdmin.from("access_points").upsert({
            bssid: s.bssid, ssid: s.ssid, channel: 6,
            encryption: pick(ENC), vendor: pick(VENDORS),
            signal_strength: rint(-60, -35), is_rogue: true,
          }, { onConflict: "bssid" });
        }
      }
    }

    return { ok: true, scenario: data.scenario, steps: steps.length, threatIds };
  });
