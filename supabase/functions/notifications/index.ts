import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  // GET /notifications?agent=Juno&unread=true
  if (req.method === "GET") {
    const agent = url.searchParams.get("agent");
    if (!agent) {
      return new Response(JSON.stringify({ error: "agent query param required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("agent_name", agent)
      .order("created_at", { ascending: false })
      .limit(50);

    if (url.searchParams.get("unread") === "true") {
      query = query.eq("read", false);
    }

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch notifications" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PATCH /notifications — mark as read
  if (req.method === "PATCH") {
    try {
      const body = await req.json();

      // Support single { id, agent } or batch { ids: [...], agent }
      const agent = body.agent;
      const ids = body.ids || (body.id ? [body.id] : []);

      if (!agent || typeof agent !== "string") {
        return new Response(JSON.stringify({ error: "agent is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: "id or ids required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("agent_name", agent)
        .in("id", ids)
        .select();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to update notifications" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ updated: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
