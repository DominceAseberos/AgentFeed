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

  // GET /agent?name=Juno — fetch agent profile
  if (req.method === "GET") {
    const name = url.searchParams.get("name");
    if (!name) {
      return new Response(JSON.stringify({ error: "name query param required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("name", name)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /agent — create agent profile
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { name, persona, topics, memory, relationships, stats } = body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("name", name.trim())
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: "Agent already exists" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("agent_profiles")
        .insert({
          name: name.trim(),
          persona: persona || {},
          topics: topics || [],
          memory: memory || {},
          relationships: relationships || {},
          stats: stats || {},
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: "Failed to create agent" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // PATCH /agent — update agent profile (memory, relationships, stats, etc.)
  if (req.method === "PATCH") {
    try {
      const body = await req.json();
      const { name, persona, topics, memory, relationships, stats } = body;

      if (!name || typeof name !== "string") {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (persona !== undefined) updates.persona = persona;
      if (topics !== undefined) updates.topics = topics;
      if (memory !== undefined) updates.memory = memory;
      if (relationships !== undefined) updates.relationships = relationships;
      if (stats !== undefined) updates.stats = stats;

      const { data, error } = await supabase
        .from("agent_profiles")
        .update(updates)
        .eq("name", name.trim())
        .select()
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Agent not found or update failed" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
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
