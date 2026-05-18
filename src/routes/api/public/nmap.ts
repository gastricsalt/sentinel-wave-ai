import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Risk classification — runs server-side so the agent can't lie about it.
const RISKY_SERVICES: Record<string, { risk: "low" | "medium" | "high" | "critical"; reason: string }> = {
  telnet:       { risk: "critical", reason: "Cleartext remote shell — credentials sniffable" },
  ftp:          { risk: "high",     reason: "Cleartext auth + frequent anonymous misconfig" },
  rlogin:       { risk: "critical", reason: "Legacy cleartext remote login" },
  rsh:          { risk: "critical", reason: "Legacy unauthenticated remote shell" },
  "ms-sql-s":   { risk: "high",     reason: "Database directly exposed" },
  mysql:        { risk: "high",     reason: "Database directly exposed" },
  postgresql:   { risk: "high",     reason: "Database directly exposed" },
  mongodb:      { risk: "high",     reason: "Database directly exposed" },
  redis:        { risk: "high",     reason: "Often unauthenticated when exposed" },
  vnc:          { risk: "high",     reason: "Remote desktop — weak default auth" },
  "ms-wbt-server": { risk: "high",  reason: "RDP exposed — brute-force / BlueKeep target" },
  smb:          { risk: "high",     reason: "SMB exposed — EternalBlue / lateral movement risk" },
  "microsoft-ds": { risk: "high",   reason: "SMB exposed — EternalBlue / lateral movement risk" },
  "netbios-ssn":  { risk: "medium", reason: "NetBIOS leaks host info" },
  snmp:         { risk: "medium",   reason: "Often default community 'public'" },
  http:         { risk: "low",      reason: "HTTP exposed — verify TLS terminator" },
  https:        { risk: "info",     reason: "HTTPS service" },
  ssh:          { risk: "low",      reason: "SSH exposed — enforce keys + fail2ban" },
};

function classifyPort(port: number, service: string | null): { risk: string; reason: string } {
  const s = (service ?? "").toLowerCase();
  if (RISKY_SERVICES[s]) return RISKY_SERVICES[s];
  if ([23, 513, 514].includes(port)) return { risk: "critical", reason: "Legacy cleartext service" };
  if ([21, 3306, 5432, 27017, 6379, 3389, 445, 139].includes(port)) {
    return { risk: "high", reason: "Sensitive service exposed" };
  }
  if ([161, 162, 69].includes(port)) return { risk: "medium", reason: "Information disclosure risk" };
  if ([80, 8080, 8000].includes(port)) return { risk: "low", reason: "HTTP service — verify TLS" };
  return { risk: "info", reason: "Open port" };
}

const PortSchema = z.object({
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(["tcp", "udp"]).default("tcp"),
  state: z.string().max(16).default("open"),
  service: z.string().max(64).nullable().optional(),
  product: z.string().max(128).nullable().optional(),
  version: z.string().max(128).nullable().optional(),
  extra_info: z.string().max(256).nullable().optional(),
  cpe: z.string().max(256).nullable().optional(),
});

const HostSchema = z.object({
  ip: z.string().min(3).max(64),
  mac: z.string().max(32).nullable().optional(),
  hostname: z.string().max(255).nullable().optional(),
  vendor: z.string().max(128).nullable().optional(),
  os_guess: z.string().max(255).nullable().optional(),
  os_accuracy: z.number().int().min(0).max(100).nullable().optional(),
  status: z.string().max(16).default("up"),
  ports: z.array(PortSchema).max(2000).default([]),
});

const ScanSchema = z.object({
  sensor_id: z.string().min(1).max(64),
  job_id: z.string().uuid().nullable().optional(),
  target: z.string().min(1).max(255),
  profile: z.enum(["discovery", "quick", "default", "intense", "vuln"]).default("default"),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  duration_ms: z.number().int().min(0).max(86_400_000).optional(),
  hosts: z.array(HostSchema).max(2000).default([]),
});

export const Route = createFileRoute("/api/public/nmap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INGEST_HMAC_SECRET;
        if (!secret) return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });

        const sig = request.headers.get("x-sentinel-signature");
        const body = await request.text();
        if (!sig) return new Response(JSON.stringify({ error: "Missing signature" }), { status: 401 });

        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
        }

        let parsed;
        try {
          parsed = ScanSchema.parse(JSON.parse(body));
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid payload", detail: (e as Error).message }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }

        // Insert scan summary
        const totalPorts = parsed.hosts.reduce((n, h) => n + h.ports.filter((p) => p.state === "open").length, 0);
        const { data: scanRow, error: scanErr } = await supabaseAdmin
          .from("network_scans")
          .insert({
            sensor_id: parsed.sensor_id,
            target: parsed.target,
            profile: parsed.profile,
            started_at: parsed.started_at ?? new Date().toISOString(),
            finished_at: parsed.finished_at ?? new Date().toISOString(),
            duration_ms: parsed.duration_ms ?? null,
            host_count: parsed.hosts.length,
            open_port_count: totalPorts,
            high_risk_count: 0,
            raw_summary: { hosts: parsed.hosts.length, ports: totalPorts },
          })
          .select("id")
          .single();
        if (scanErr || !scanRow) {
          return new Response(JSON.stringify({ error: "Insert failed", detail: scanErr?.message }), { status: 500 });
        }
        const scanId = scanRow.id;

        let highRisk = 0;

        for (const host of parsed.hosts) {
          let hostHighest: "info" | "low" | "medium" | "high" | "critical" = "info";
          let hostOpen = 0;
          const classifiedPorts = host.ports
            .filter((p) => p.state === "open")
            .map((p) => {
              const c = classifyPort(p.port, p.service ?? null);
              if (["high", "critical"].includes(c.risk)) highRisk++;
              const rank = ["info", "low", "medium", "high", "critical"];
              if (rank.indexOf(c.risk) > rank.indexOf(hostHighest)) hostHighest = c.risk as typeof hostHighest;
              hostOpen++;
              return { ...p, ...c };
            });

          const { data: hostRow, error: hostErr } = await supabaseAdmin
            .from("scan_hosts")
            .insert({
              scan_id: scanId,
              ip: host.ip,
              mac: host.mac ?? null,
              hostname: host.hostname ?? null,
              vendor: host.vendor ?? null,
              os_guess: host.os_guess ?? null,
              os_accuracy: host.os_accuracy ?? null,
              status: host.status,
              open_port_count: hostOpen,
              highest_risk: hostHighest,
            })
            .select("id")
            .single();
          if (hostErr || !hostRow) continue;

          if (classifiedPorts.length) {
            await supabaseAdmin.from("scan_ports").insert(
              classifiedPorts.map((p) => ({
                host_id: hostRow.id,
                scan_id: scanId,
                port: p.port,
                protocol: p.protocol,
                state: p.state,
                service: p.service ?? null,
                product: p.product ?? null,
                version: p.version ?? null,
                extra_info: p.extra_info ?? null,
                cpe: p.cpe ?? null,
                risk: p.risk,
                risk_reason: p.reason,
              })),
            );
          }
        }

        await supabaseAdmin.from("network_scans").update({ high_risk_count: highRisk }).eq("id", scanId);

        // Mark job complete if this scan was queued
        if (parsed.job_id) {
          await supabaseAdmin
            .from("scan_jobs")
            .update({ status: "completed", completed_at: new Date().toISOString(), scan_id: scanId })
            .eq("id", parsed.job_id);
        }

        // Surface critical findings as alerts
        if (highRisk > 0) {
          await supabaseAdmin.from("alerts").insert({
            message: `Nmap scan of ${parsed.target} surfaced ${highRisk} high/critical exposures across ${parsed.hosts.length} hosts`,
            severity: highRisk >= 5 ? "critical" : "high",
          });
        }

        return new Response(
          JSON.stringify({ ok: true, scan_id: scanId, hosts: parsed.hosts.length, open_ports: totalPorts, high_risk: highRisk }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
