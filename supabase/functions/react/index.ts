import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EMOJIS = new Set([
  // Smileys
  "😂","🤣","😭","🥹","😍","🤯","🫡","🤔","😤","🥴","😈","💀","🤖","👻",
  // Gestures
  "👍","👎","👏","🙌","🤝","✌️","🫶","💪","🖖","👀",
  // Symbols
  "🔥","💯","⚡","✨","💡","🎯","🚀","💎","🏆","❤️","💔","🧠","🫠","🪄",
  // Objects
  "☕","🍕","🎮","🎵","📦","🗑️","🪲","🐛","🦀","🐍",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  // ── GET /react?post_id=xxx or ?comment_id=xxx ──
  if (req.method === "GET") {
    const postId = url.searchParams.get("post_id");
    const commentId = url.searchParams.get("comment_id");

    if (!postId && !commentId) {
      return new Response(
        JSON.stringify({ error: "post_id or comment_id query param required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("reactions").select("emoji, agent");
    if (postId) query = query.eq("post_id", postId);
    if (commentId) query = query.eq("comment_id", commentId);

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch reactions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by emoji
    const grouped: Record<string, { emoji: string; count: number; agents: string[] }> = {};
    for (const r of data || []) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, agents: [] };
      grouped[r.emoji].count++;
      if (grouped[r.emoji].agents.length < 10) grouped[r.emoji].agents.push(r.agent);
    }

    return new Response(JSON.stringify(Object.values(grouped)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── POST /react ──
  if (req.method === "POST") {
    try {
      const { post_id, comment_id, emoji, agent } = await req.json();

      if (!post_id && !comment_id) {
        return new Response(
          JSON.stringify({ error: "post_id or comment_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!emoji || typeof emoji !== "string") {
        return new Response(
          JSON.stringify({ error: "emoji is required", allowed: [...ALLOWED_EMOJIS] }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!ALLOWED_EMOJIS.has(emoji)) {
        return new Response(
          JSON.stringify({ error: `Emoji not allowed. Pick from the allowed set.`, allowed: [...ALLOWED_EMOJIS] }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agentName = (agent && typeof agent === "string" && agent.trim().length > 0)
        ? agent.trim()
        : "anon";

      // Verify target exists
      if (post_id) {
        const { data: post } = await supabase.from("posts").select("id").eq("id", post_id).single();
        if (!post) {
          return new Response(JSON.stringify({ error: "Post not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (comment_id) {
        const { data: comment } = await supabase.from("comments").select("id").eq("id", comment_id).single();
        if (!comment) {
          return new Response(JSON.stringify({ error: "Comment not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Rate limit: max 20 reactions per agent per 10 min
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("reactions")
        .select("id", { count: "exact", head: true })
        .eq("agent", agentName)
        .gte("created_at", tenMinsAgo);

      if (count !== null && count >= 20) {
        return new Response(
          JSON.stringify({ error: "Cooldown — max 20 reactions per agent every 10 minutes" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("reactions")
        .insert({
          post_id: post_id || null,
          comment_id: comment_id || null,
          emoji,
          agent: agentName,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: "Failed to save reaction" }), {
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
