import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VENDORS = ["Cisco", "TP-Link", "Netgear", "Ubiquiti", "Aruba", "Apple", "Samsung", "Intel", "Broadcom", "Realtek", "Dell", "Huawei"];
const ENC = ["WPA3", "WPA2", "WPA2/WPA3", "WPA", "OPEN"];
const COMMON_SSIDS = ["CorpNet-Guest", "CorpNet", "Office-WiFi", "Cafe_Free", "Boardroom-5G", "EngVPN", "Lobby", "Reception"];

function randMac(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(":");
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r) => r.role === "admin")) throw new Error("Admin only");
}

export const runSimulationTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);

    // Get existing APs and clients to mostly update, sometimes add
    const { data: existingAps } = await supabaseAdmin.from("access_points").select("bssid,ssid,channel").limit(40);
    const aps = existingAps ?? [];

    // Add 0-2 new APs
    const newAps: Array<{ ssid: string; bssid: string; channel: number; encryption: string; vendor: string; signal_strength: number }> = [];
    for (let i = 0; i < randInt(0, 2); i++) {
      newAps.push({
        ssid: pick(COMMON_SSIDS),
        bssid: randMac(),
        channel: pick([1, 6, 11, 36, 44, 149]),
        encryption: pick(ENC),
        vendor: pick(VENDORS),
        signal_strength: randInt(-85, -35),
      });
    }
    if (newAps.length) await supabaseAdmin.from("access_points").upsert(newAps, { onConflict: "bssid" });

    // Touch some existing APs (last_seen + new RSSI)
    for (const ap of aps.slice(0, 5)) {
      await supabaseAdmin
        .from("access_points")
        .update({ last_seen: new Date().toISOString(), signal_strength: randInt(-85, -35) })
        .eq("bssid", ap.bssid);
    }

    // Add some clients
    const newClients = Array.from({ length: randInt(1, 3) }, () => ({
      mac: randMac(),
      vendor: pick(VENDORS),
      associated_bssid: aps.length ? pick(aps).bssid : null,
      signal_strength: randInt(-90, -40),
      packets_seen: randInt(10, 5000),
      is_random_mac: Math.random() < 0.3,
    }));
    await supabaseAdmin.from("clients").upsert(newClients, { onConflict: "mac" });

    // Maybe inject a random threat (40% chance)
    if (Math.random() < 0.4) {
      await injectRandomThreat();
    }

    return { ok: true, newAps: newAps.length, newClients: newClients.length };
  });

const ATTACK_TEMPLATES: Record<string, () => { description: string; severity: "warning" | "high" | "critical"; confidence: number; ssid?: string; bssid?: string; source_mac?: string; metadata: Record<string, unknown> }> = {
  rogue_ap: () => ({
    description: `Unrecognized AP broadcasting on a managed channel`,
    severity: "high",
    confidence: 0.82,
    ssid: pick(COMMON_SSIDS),
    bssid: randMac(),
    metadata: { reason: "Unknown BSSID with whitelisted SSID prefix" },
  }),
  evil_twin: () => ({
    description: `Duplicate SSID detected with mismatched BSSID — possible Evil Twin`,
    severity: "critical",
    confidence: 0.91,
    ssid: pick(COMMON_SSIDS),
    bssid: randMac(),
    metadata: { rssi_delta: randInt(15, 35), channel_mismatch: true },
  }),
  deauth_flood: () => ({
    description: `Burst of ${randInt(80, 400)} deauthentication frames in 5s window`,
    severity: "critical",
    confidence: 0.95,
    source_mac: randMac(),
    bssid: randMac(),
    metadata: { pps: randInt(60, 200), targets: randInt(2, 12) },
  }),
  beacon_flood: () => ({
    description: `Beacon flood: ${randInt(50, 200)} unique SSIDs from one source`,
    severity: "high",
    confidence: 0.88,
    source_mac: randMac(),
    metadata: { unique_ssids: randInt(50, 200), pps: randInt(40, 120) },
  }),
  mac_spoof: () => ({
    description: `MAC vendor mismatch and impossible movement pattern`,
    severity: "warning",
    confidence: 0.74,
    source_mac: randMac(),
    metadata: { vendor_changed: true },
  }),
  anomaly: () => ({
    description: `ML model flagged anomalous beacon timing pattern`,
    severity: "warning",
    confidence: 0.68,
    bssid: randMac(),
    metadata: { model: "isolation_forest", score: Math.random().toFixed(3) },
  }),
};

async function injectRandomThreat() {
  const types = Object.keys(ATTACK_TEMPLATES) as Array<keyof typeof ATTACK_TEMPLATES>;
  const type = pick(types);
  await injectAttackInternal(type);
}

async function injectAttackInternal(type: string) {
  const tpl = ATTACK_TEMPLATES[type]?.();
  if (!tpl) throw new Error("Unknown attack type");
  const { data: threat, error } = await supabaseAdmin
    .from("threats")
    .insert({
      type,
      severity: tpl.severity,
      confidence: tpl.confidence,
      bssid: tpl.bssid ?? null,
      ssid: tpl.ssid ?? null,
      source_mac: tpl.source_mac ?? null,
      description: tpl.description,
      metadata: tpl.metadata,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("alerts").insert({
    message: `[${type.toUpperCase()}] ${tpl.description}`,
    severity: tpl.severity,
    threat_id: threat.id,
  });
  if (type === "rogue_ap" || type === "evil_twin") {
    if (tpl.bssid) {
      await supabaseAdmin.from("access_points").upsert(
        {
          bssid: tpl.bssid,
          ssid: tpl.ssid,
          channel: pick([1, 6, 11, 36]),
          encryption: pick(ENC),
          vendor: pick(VENDORS),
          signal_strength: randInt(-70, -30),
          is_rogue: true,
        },
        { onConflict: "bssid" },
      );
    }
  }
  return threat;
}

export const injectAttack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      type: z.enum(["rogue_ap", "evil_twin", "deauth_flood", "beacon_flood", "mac_spoof", "anomaly"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const t = await injectAttackInternal(data.type);
    return { ok: true, id: t.id };
  });

export const wipeDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    await supabaseAdmin.from("alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("threats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("clients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("access_points").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return { ok: true };
  });
