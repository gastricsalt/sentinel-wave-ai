import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { matchCves } from "./cve-knowledge";

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r) => r.role === "admin")) throw new Error("Admin role required");
}

// ---------- Run assessment over a scan ----------
export const runAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scanId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);

    // Wipe previous findings for this scan so a re-run is idempotent
    await supabaseAdmin.from("host_cves").delete().eq("scan_id", data.scanId);
    await supabaseAdmin.from("security_recommendations").delete().eq("scan_id", data.scanId);

    const [{ data: hosts }, { data: ports }, { data: threats }, { data: baseline }] = await Promise.all([
      supabaseAdmin.from("scan_hosts").select("*").eq("scan_id", data.scanId),
      supabaseAdmin.from("scan_ports").select("*").eq("scan_id", data.scanId),
      supabaseAdmin.from("threats").select("id,type,severity,bssid,source_mac,description,detected_at")
        .gte("detected_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
      supabaseAdmin.from("network_baseline").select("mac,ip,approved"),
    ]);

    const cveRows: Array<Record<string, unknown>> = [];
    const recRows: Array<Record<string, unknown>> = [];
    const portsByHost: Record<string, typeof ports> = {};
    for (const p of ports ?? []) (portsByHost[p.host_id] ??= []).push(p);

    const approvedMacs = new Set((baseline ?? []).filter((b) => b.approved && b.mac).map((b) => b.mac!.toLowerCase()));

    let critical = 0, high = 0, medium = 0;
    const iotHosts: string[] = [];

    for (const host of hosts ?? []) {
      const hostPorts = portsByHost[host.id] ?? [];

      // Heuristic: classify IoT-ish
      const looksIot = /camera|printer|tv|iot|hikvision|dahua|jetdirect|hue|sonos|nest|esp/i.test(
        [host.vendor, host.hostname, host.os_guess].filter(Boolean).join(" "),
      );
      if (looksIot) iotHosts.push(host.id);

      // Unauthorized device
      if (host.mac && approvedMacs.size > 0 && !approvedMacs.has(host.mac.toLowerCase())) {
        recRows.push({
          title: `Unauthorized device on network (${host.ip})`,
          rationale: `MAC ${host.mac} is not in the approved baseline. Verify ownership or quarantine.`,
          category: "baseline",
          priority: "high",
          host_id: host.id,
          scan_id: data.scanId,
        });
      }

      for (const port of hostPorts) {
        const hits = matchCves({
          service: port.service,
          product: port.product,
          version: port.version,
          port: port.port,
        });
        for (const h of hits) {
          cveRows.push({
            host_id: host.id,
            scan_id: data.scanId,
            port_id: port.id,
            cve_id: h.cve,
            cvss: h.cvss,
            severity: h.severity,
            summary: h.summary,
            product: port.product ?? port.service,
            version: port.version,
            exploit_available: h.exploitAvailable ?? false,
            reference_url: h.reference ?? null,
          });
          if (h.severity === "critical") critical++;
          else if (h.severity === "high") high++;
          else if (h.severity === "medium") medium++;

          recRows.push({
            title: remediationTitle(h.cve, port.service ?? port.product ?? "service"),
            rationale: `${h.cve} (CVSS ${h.cvss}) on ${host.ip}:${port.port}/${port.protocol} — ${h.summary}`,
            category: looksIot ? "iot" : "network",
            priority: h.severity === "critical" ? "critical" : h.severity === "high" ? "high" : "medium",
            host_id: host.id,
            scan_id: data.scanId,
          });
        }
      }
    }

    // Wireless correlation — a rogue AP near a vulnerable host = critical chain
    const rogueOrEvilTwin = (threats ?? []).filter((t) =>
      ["rogue_ap", "evil_twin", "karma", "pmkid", "deauth"].includes(t.type as string),
    );
    if (rogueOrEvilTwin.length && (critical + high) > 0) {
      recRows.push({
        title: "Critical: wireless attack co-occurs with vulnerable network services",
        rationale: `${rogueOrEvilTwin.length} active wireless threat(s) detected in the last 24h while ${critical + high} high/critical service vulnerabilities are present. Investigate as a coordinated attack chain.`,
        category: "correlation",
        priority: "critical",
        scan_id: data.scanId,
      });
    }

    if (cveRows.length) await supabaseAdmin.from("host_cves").insert(cveRows);
    if (recRows.length) await supabaseAdmin.from("security_recommendations").insert(recRows);

    // Security score — start at 100, deduct
    const score = {
      overall: 100,
      wireless: 100,
      network: 100,
      iot: 100,
      encryption: 100,
    };
    score.network -= Math.min(80, critical * 20 + high * 10 + medium * 4);
    score.wireless -= Math.min(80, rogueOrEvilTwin.length * 15);
    score.iot -= Math.min(80, iotHosts.length * 8);
    score.encryption -= cveRows.filter((c) => /telnet|ftp|rlogin/i.test(String(c.cve_id))).length * 15;
    score.encryption = Math.max(0, score.encryption);
    score.overall = Math.round(
      0.35 * score.network + 0.3 * score.wireless + 0.2 * score.iot + 0.15 * score.encryption,
    );

    const { data: scoreRow } = await supabaseAdmin
      .from("security_scores")
      .insert({
        scan_id: data.scanId,
        ...score,
        details: { critical, high, medium, iot_hosts: iotHosts.length, wireless_threats: rogueOrEvilTwin.length },
      })
      .select("id, overall")
      .single();

    return { ok: true, score: scoreRow, cve_count: cveRows.length, rec_count: recRows.length };
  });

function remediationTitle(cve: string, service: string): string {
  if (cve === "INTERNAL-TELNET") return "Disable Telnet — replace with SSH";
  if (cve === "INTERNAL-FTP") return "Replace FTP with SFTP/FTPS";
  if (cve === "INTERNAL-RLOGIN") return "Disable rlogin/rsh/rexec";
  if (cve === "INTERNAL-SNMP-COMMUNITY") return "Change SNMP community strings, prefer SNMPv3";
  if (cve.startsWith("INTERNAL-")) return `Restrict network exposure of ${service}`;
  return `Patch ${service} — ${cve}`;
}

// ---------- Reads ----------
export const getAssessmentSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [{ data: score }, { data: cves }, { data: recs }, { data: scans }] = await Promise.all([
      supabaseAdmin.from("security_scores").select("*").order("computed_at", { ascending: false }).limit(1),
      supabaseAdmin.from("host_cves").select("id,severity").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("security_recommendations").select("id,status,priority").limit(500),
      supabaseAdmin.from("network_scans").select("id,target,started_at,high_risk_count").order("started_at", { ascending: false }).limit(5),
    ]);

    const cveBuckets = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const c of cves ?? []) cveBuckets[(c.severity as keyof typeof cveBuckets) ?? "low"]++;
    const openRecs = (recs ?? []).filter((r) => r.status === "open").length;

    return {
      score: score?.[0] ?? null,
      cveBuckets,
      openRecs,
      totalRecs: recs?.length ?? 0,
      recentScans: scans ?? [],
    };
  });

export const listCves = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scanId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("host_cves").select("*, scan_hosts!inner(ip,hostname,mac,vendor)").order("cvss", { ascending: false }).limit(200);
    if (data.scanId) q = q.eq("scan_id", data.scanId);
    const { data: rows } = await q;
    return { cves: rows ?? [] };
  });

export const listRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("security_recommendations")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    return { recommendations: data ?? [] };
  });

export const updateRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "in_progress", "resolved", "dismissed"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await supabaseAdmin.from("security_recommendations").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const listBaseline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("network_baseline").select("*").order("last_seen", { ascending: false });
    return { devices: data ?? [] };
  });

export const upsertBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      mac: z.string().min(1).max(32),
      ip: z.string().max(64).optional(),
      label: z.string().max(128).optional(),
      device_type: z.string().max(64).optional(),
      approved: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await supabaseAdmin.from("network_baseline").upsert(
      { ...data, last_seen: new Date().toISOString() },
      { onConflict: "mac" },
    );
    return { ok: true };
  });
