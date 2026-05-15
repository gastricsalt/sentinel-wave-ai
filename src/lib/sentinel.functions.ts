import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [aps, clients, threats, criticals, recentThreats, alerts] = await Promise.all([
      supabaseAdmin.from("access_points").select("id, is_rogue, channel", { count: "exact" }),
      supabaseAdmin.from("clients").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("threats").select("id, type, severity, detected_at, acknowledged"),
      supabaseAdmin.from("threats").select("id", { count: "exact", head: true }).eq("severity", "critical").gte("detected_at", since24h),
      supabaseAdmin.from("threats").select("detected_at, severity").gte("detected_at", since7d).order("detected_at"),
      supabaseAdmin.from("alerts").select("id,message,severity,created_at,acknowledged").order("created_at", { ascending: false }).limit(15),
    ]);

    const channels: Record<number, number> = {};
    (aps.data ?? []).forEach((a) => {
      if (a.channel) channels[a.channel] = (channels[a.channel] ?? 0) + 1;
    });
    const channelData = Object.entries(channels)
      .map(([ch, count]) => ({ channel: `Ch ${ch}`, count }))
      .sort((a, b) => Number(a.channel.slice(3)) - Number(b.channel.slice(3)));

    const typeCounts: Record<string, number> = {};
    (threats.data ?? []).forEach((t) => {
      typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
    });
    const typeDistribution = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));

    // Bucket recent threats by hour
    const buckets: Record<string, { time: string; total: number; critical: number; high: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 60 * 60 * 1000);
      const key = `${d.getHours()}:00`;
      buckets[key] = { time: key, total: 0, critical: 0, high: 0 };
    }
    (recentThreats.data ?? []).forEach((t) => {
      const d = new Date(t.detected_at);
      const key = `${d.getHours()}:00`;
      if (buckets[key]) {
        buckets[key].total += 1;
        if (t.severity === "critical") buckets[key].critical += 1;
        if (t.severity === "high") buckets[key].high += 1;
      }
    });

    return {
      apCount: aps.count ?? 0,
      rogueCount: (aps.data ?? []).filter((a) => a.is_rogue).length,
      clientCount: clients.count ?? 0,
      activeThreats: (threats.data ?? []).filter((t) => !t.acknowledged).length,
      criticalLast24h: criticals.count ?? 0,
      channelData,
      typeDistribution,
      timeline: Object.values(buckets),
      alerts: alerts.data ?? [],
    };
  });

export const listAccessPoints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("access_points")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listThreats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("threats")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const ackThreat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Admin only");
    const { error } = await supabaseAdmin
      .from("threats")
      .update({ acknowledged: true, acknowledged_by: context.userId, acknowledged_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("alerts").update({ acknowledged: true }).eq("threat_id", data.id);
    return { ok: true };
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role);
    return { roles, isAdmin: roles.includes("admin") };
  });
