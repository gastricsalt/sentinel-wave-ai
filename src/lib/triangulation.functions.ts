import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Log-distance path-loss: RSSI(d) = RSSI(1m) - 10n log10(d)
// Solve for d.
function rssiToDistance(rssi: number, txPowerAt1m = -40, pathLossExp = 2.7): number {
  return Math.pow(10, (txPowerAt1m - rssi) / (10 * pathLossExp));
}

function estimatePosition(samples: Array<{ x: number; y: number; rssi: number }>) {
  if (samples.length === 0) return null;
  // Weighted centroid by 1/distance
  let sx = 0, sy = 0, sw = 0;
  for (const s of samples) {
    const d = Math.max(0.5, rssiToDistance(s.rssi));
    const w = 1 / (d * d);
    sx += s.x * w;
    sy += s.y * w;
    sw += w;
  }
  if (sw === 0) return null;
  const x = sx / sw;
  const y = sy / sw;
  // Confidence: spread of weights
  const conf = Math.min(1, samples.length / 3) * Math.min(1, sw * 10);
  return { x, y, confidence: conf };
}

export const seedRssi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bssid: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { data: sensors } = await supabaseAdmin.from("sensors").select("sensor_id,x_meters,y_meters");
    // Simulated attacker location near center
    const ax = 20 + Math.random() * 10;
    const ay = 15 + Math.random() * 10;
    const samples: { sensor_id: string; target_bssid: string; rssi: number; channel: number }[] = [];
    for (const s of sensors ?? []) {
      const dx = Number(s.x_meters) - ax;
      const dy = Number(s.y_meters) - ay;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const rssi = Math.round(-40 - 10 * 2.7 * Math.log10(d) + (Math.random() * 6 - 3));
      samples.push({ sensor_id: s.sensor_id, target_bssid: data.bssid, rssi, channel: 6 });
    }
    if (samples.length) await supabaseAdmin.from("rssi_observations").insert(samples);
    return { ok: true, samples: samples.length };
  });

export const triangulate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bssid: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const [{ data: sensors }, { data: obs }] = await Promise.all([
      supabaseAdmin.from("sensors").select("*"),
      supabaseAdmin.from("rssi_observations").select("*").eq("target_bssid", data.bssid).gte("observed_at", since),
    ]);
    const sensorMap = new Map((sensors ?? []).map((s) => [s.sensor_id, s]));
    // Latest RSSI per sensor
    const latestPer: Record<string, { x: number; y: number; rssi: number }> = {};
    for (const o of obs ?? []) {
      const s = sensorMap.get(o.sensor_id);
      if (!s) continue;
      const cur = latestPer[o.sensor_id];
      if (!cur || o.rssi > (cur.rssi - 1)) {
        latestPer[o.sensor_id] = { x: Number(s.x_meters), y: Number(s.y_meters), rssi: o.rssi };
      }
    }
    const samples = Object.values(latestPer);
    const estimate = estimatePosition(samples);
    return { sensors: sensors ?? [], samples, estimate };
  });

export const listTrackedBssids = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("rssi_observations")
      .select("target_bssid")
      .order("observed_at", { ascending: false })
      .limit(200);
    const set = new Set((data ?? []).map((r) => r.target_bssid));
    return { bssids: Array.from(set) };
  });
