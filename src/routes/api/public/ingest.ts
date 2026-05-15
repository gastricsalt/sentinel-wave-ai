import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PayloadSchema = z.object({
  sensor_id: z.string().min(1).max(64),
  access_points: z
    .array(
      z.object({
        ssid: z.string().max(64).nullable().optional(),
        bssid: z.string().regex(/^[0-9a-f:]{17}$/i),
        channel: z.number().int().min(1).max(200).optional(),
        encryption: z.string().max(32).optional(),
        vendor: z.string().max(64).optional(),
        signal_strength: z.number().int().min(-120).max(0).optional(),
        is_hidden: z.boolean().optional(),
      }),
    )
    .max(500)
    .optional()
    .default([]),
  clients: z
    .array(
      z.object({
        mac: z.string().regex(/^[0-9a-f:]{17}$/i),
        vendor: z.string().max(64).optional(),
        associated_bssid: z.string().regex(/^[0-9a-f:]{17}$/i).nullable().optional(),
        signal_strength: z.number().int().min(-120).max(0).optional(),
        packets_seen: z.number().int().min(0).optional(),
        is_random_mac: z.boolean().optional(),
      }),
    )
    .max(2000)
    .optional()
    .default([]),
  threats: z
    .array(
      z.object({
        type: z.enum(["rogue_ap", "evil_twin", "deauth_flood", "beacon_flood", "mac_spoof", "anomaly"]),
        severity: z.enum(["info", "warning", "high", "critical"]).optional(),
        confidence: z.number().min(0).max(1).optional(),
        bssid: z.string().regex(/^[0-9a-f:]{17}$/i).optional(),
        ssid: z.string().max(64).optional(),
        source_mac: z.string().regex(/^[0-9a-f:]{17}$/i).optional(),
        description: z.string().min(1).max(500),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(500)
    .optional()
    .default([]),
});

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INGEST_HMAC_SECRET;
        if (!secret) {
          return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });
        }
        const sigHeader = request.headers.get("x-sentinel-signature");
        const body = await request.text();
        if (!sigHeader) return new Response(JSON.stringify({ error: "Missing signature" }), { status: 401 });
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(sigHeader);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
        }

        let parsed;
        try {
          parsed = PayloadSchema.parse(JSON.parse(body));
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Invalid payload", detail: (e as Error).message }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const now = new Date().toISOString();

        if (parsed.access_points.length) {
          await supabaseAdmin.from("access_points").upsert(
            parsed.access_points.map((a) => ({
              ssid: a.ssid ?? null,
              bssid: a.bssid.toLowerCase(),
              channel: a.channel ?? null,
              encryption: a.encryption ?? null,
              vendor: a.vendor ?? null,
              signal_strength: a.signal_strength ?? null,
              is_hidden: a.is_hidden ?? false,
              last_seen: now,
            })),
            { onConflict: "bssid" },
          );
        }

        if (parsed.clients.length) {
          await supabaseAdmin.from("clients").upsert(
            parsed.clients.map((c) => ({
              mac: c.mac.toLowerCase(),
              vendor: c.vendor ?? null,
              associated_bssid: c.associated_bssid?.toLowerCase() ?? null,
              signal_strength: c.signal_strength ?? null,
              packets_seen: c.packets_seen ?? 0,
              is_random_mac: c.is_random_mac ?? false,
              last_seen: now,
            })),
            { onConflict: "mac" },
          );
        }

        // Server-side evil-twin augmentation: if reported rogue_ap shares an SSID with another AP, escalate
        if (parsed.threats.length) {
          const enriched = await Promise.all(
            parsed.threats.map(async (t) => {
              let severity = t.severity ?? "warning";
              let confidence = t.confidence ?? 0.5;
              if ((t.type === "rogue_ap" || t.type === "anomaly") && t.ssid) {
                const { data: dupes } = await supabaseAdmin
                  .from("access_points")
                  .select("bssid")
                  .eq("ssid", t.ssid);
                if ((dupes ?? []).length >= 2) {
                  severity = "critical";
                  confidence = Math.max(confidence, 0.9);
                }
              }
              return {
                type: t.type,
                severity,
                confidence,
                bssid: t.bssid?.toLowerCase() ?? null,
                ssid: t.ssid ?? null,
                source_mac: t.source_mac?.toLowerCase() ?? null,
                description: t.description,
                metadata: { ...(t.metadata ?? {}), sensor_id: parsed.sensor_id },
              };
            }),
          );
          const { data: inserted } = await supabaseAdmin.from("threats").insert(enriched).select("id,severity,description,type");
          if (inserted?.length) {
            await supabaseAdmin.from("alerts").insert(
              inserted.map((t) => ({
                message: `[${t.type.toUpperCase()}] ${t.description}`,
                severity: t.severity,
                threat_id: t.id,
              })),
            );
          }
        }

        await supabaseAdmin.from("ingest_events").insert({
          sensor_id: parsed.sensor_id,
          payload: { sizes: { aps: parsed.access_points.length, clients: parsed.clients.length, threats: parsed.threats.length } },
          ap_count: parsed.access_points.length,
          client_count: parsed.clients.length,
          threat_count: parsed.threats.length,
        });

        return new Response(
          JSON.stringify({ ok: true, accepted: { aps: parsed.access_points.length, clients: parsed.clients.length, threats: parsed.threats.length } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
