import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Agent polls this endpoint for queued scan jobs.
// Authentication: HMAC over the request method + path + timestamp header.
// (No body for GET, so we sign METHOD:PATH:TS to prevent replay across endpoints.)
export const Route = createFileRoute("/api/public/scan-jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.INGEST_HMAC_SECRET;
        if (!secret) return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });

        const sig = request.headers.get("x-sentinel-signature");
        const ts = request.headers.get("x-sentinel-timestamp");
        const sensorId = request.headers.get("x-sentinel-sensor") ?? "unknown";
        if (!sig || !ts) return new Response(JSON.stringify({ error: "Missing signature" }), { status: 401 });

        const skewMs = Math.abs(Date.now() - new Date(ts).getTime());
        if (Number.isNaN(skewMs) || skewMs > 5 * 60 * 1000) {
          return new Response(JSON.stringify({ error: "Stale timestamp" }), { status: 401 });
        }

        const url = new URL(request.url);
        const message = `GET:${url.pathname}:${ts}`;
        const expected = createHmac("sha256", secret).update(message).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
        }

        // Atomically claim the oldest queued job
        const { data: queued } = await supabaseAdmin
          .from("scan_jobs")
          .select("id,target,profile")
          .eq("status", "queued")
          .order("created_at", { ascending: true })
          .limit(1);

        if (!queued?.length) {
          return new Response(JSON.stringify({ job: null }), { status: 200, headers: { "content-type": "application/json" } });
        }

        const job = queued[0];
        const { data: claimed } = await supabaseAdmin
          .from("scan_jobs")
          .update({ status: "running", claimed_at: new Date().toISOString(), assigned_sensor: sensorId })
          .eq("id", job.id)
          .eq("status", "queued")
          .select("id,target,profile")
          .single();

        return new Response(JSON.stringify({ job: claimed ?? null }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
