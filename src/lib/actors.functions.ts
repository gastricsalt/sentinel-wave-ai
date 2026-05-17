import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listActors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("threat_actors")
      .select("*")
      .order("last_seen", { ascending: false });
    return { actors: data ?? [] };
  });

export const getActor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const [{ data: actor }, { data: threats }, { data: incidents }] = await Promise.all([
      supabaseAdmin.from("threat_actors").select("*").eq("id", data.id).single(),
      supabaseAdmin.from("threats").select("*").eq("actor_id", data.id).order("detected_at", { ascending: false }).limit(50),
      supabaseAdmin.from("incidents").select("*").eq("actor_id", data.id).order("last_event_at", { ascending: false }),
    ]);
    return { actor, threats: threats ?? [], incidents: incidents ?? [] };
  });
