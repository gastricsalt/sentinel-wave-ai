import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("network_scans")
      .select("id,sensor_id,target,profile,started_at,finished_at,duration_ms,host_count,open_port_count,high_risk_count")
      .order("started_at", { ascending: false })
      .limit(50);
    return { scans: data ?? [] };
  });

export const getScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const [{ data: scan }, { data: hosts }, { data: ports }] = await Promise.all([
      supabaseAdmin.from("network_scans").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("scan_hosts").select("*").eq("scan_id", data.id).order("highest_risk", { ascending: false }),
      supabaseAdmin.from("scan_ports").select("*").eq("scan_id", data.id).order("port", { ascending: true }),
    ]);
    return { scan, hosts: hosts ?? [], ports: ports ?? [] };
  });

export const listScanJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("scan_jobs")
      .select("id,target,profile,status,assigned_sensor,created_at,completed_at,scan_id,error")
      .order("created_at", { ascending: false })
      .limit(30);
    return { jobs: data ?? [] };
  });

const CIDR = /^[0-9.]+(\/[0-9]{1,2})?$|^[0-9.]+-[0-9.]+$|^[a-zA-Z0-9.\-]+$/;

export const queueScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      target: z.string().min(1).max(255).regex(CIDR, "Target must be a CIDR, IP, range or hostname"),
      profile: z.enum(["discovery", "quick", "default", "intense", "vuln"]).default("default"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Admin role required to queue scans");

    const { data: job, error } = await supabaseAdmin
      .from("scan_jobs")
      .insert({ target: data.target, profile: data.profile, requested_by: context.userId })
      .select("id,target,profile,status,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { job };
  });

export const cancelScanJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "admin")) throw new Error("Admin required");
    await supabaseAdmin.from("scan_jobs").update({ status: "cancelled" }).eq("id", data.id).eq("status", "queued");
    return { ok: true };
  });
