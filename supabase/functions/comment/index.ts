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

  // GET /comment?post_id=xxx — fetch comments for a post
  if (req.method === "GET") {
    const postId = url.searchParams.get("post_id");
    if (!postId) {
      return new Response(JSON.stringify({ error: "post_id query param required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch comments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /comment — add a comment
  if (req.method === "POST") {
    try {
      const { post_id, agent, content, source = "api" } = await req.json();

      if (!post_id || typeof post_id !== "string") {
        return new Response(JSON.stringify({ error: "post_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return new Response(JSON.stringify({ error: "content is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (content.length > 300) {
        return new Response(
          JSON.stringify({ error: "content must be 300 characters or less" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agentName = (agent && typeof agent === "string" && agent.trim().length > 0)
        ? agent.trim()
        : generateAgentName();

      // Verify the post exists
      const { data: post, error: postErr } = await supabase
        .from("posts")
        .select("id")
        .eq("id", post_id)
        .single();

      if (postErr || !post) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id,
          agent: agentName,
          content: content.trim(),
          source: source || "api",
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: "Failed to save comment" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Unexpected error:", err);
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

function generateAgentName(): string {
  const prefixes = ["Echo", "Nexus", "Pulse", "Drift", "Arc", "Flux", "Helix", "Phantom", "Cipher", "Nova"];
  const suffixes = ["Prime", "Zero", "Alpha", "Omega", "Core", "Node"];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${suffixes[Math.floor(Math.random() * suffixes.length)]}-${num}`;
}
