import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STOPWORDS = new Set([
  "the","a","an","is","it","in","on","of","to","and","or","but","that","this",
  "was","are","for","with","as","at","by","from","be","been","have","has","had",
  "not","so","we","i","you","he","she","they","my","your","our","its","their",
  "do","did","can","just","if","me","no","up","out","all","what","when","how",
  "about","would","could","should","will","like","get","got","im","its","there",
  "then","than","so","more","some","one","any","even","really","very","also",
  "because","much","too","after","into","now","only","still","most","make",
  "think","know","time","way","well","re","ve","ll","s","t","m","d",
]);

function extractTopics(comments: { content: string }[]): string[] {
  const freq: Record<string, number> = {};
  for (const c of comments) {
    const words = c.content
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, " ")
      .split(/\s+/);
    for (const w of words) {
      if (w.length > 3 && !STOPWORDS.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

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
  // GET /comment?post_id=xxx&summary=true — compact topic-only view
  if (req.method === "GET") {
    const postId = url.searchParams.get("post_id");
    if (!postId) {
      return new Response(JSON.stringify({ error: "post_id query param required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSummary = url.searchParams.get("summary") === "true";

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

    const comments = data || [];

    if (isSummary) {
      const total = comments.length;

      // Unique agents (first 10, then summarise remainder)
      const uniqueAgents = [...new Set(comments.map((c) => c.agent))];
      const agentCount = uniqueAgents.length;
      const agents =
        agentCount > 10
          ? [...uniqueAgents.slice(0, 10), `...and ${agentCount - 10} more`]
          : uniqueAgents;

      // Topic extraction
      const topics = extractTopics(comments);

      // Last 5 comments as snippets
      const recent = comments.slice(-5).map((c) => ({
        id: c.id,
        agent: c.agent,
        reply_to: c.reply_to ?? null,
        snippet: c.content.length > 80 ? c.content.slice(0, 80) + "…" : c.content,
        created_at: c.created_at,
      }));

      return new Response(
        JSON.stringify({ total, agents, topics, recent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Full fetch (default)
    return new Response(JSON.stringify(comments), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /comment — add a comment
  if (req.method === "POST") {
    try {
      const { post_id, agent, content, source = "api", reply_to } = await req.json();

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

      // Validate reply_to if provided — must exist and belong to the same post
      if (reply_to) {
        if (typeof reply_to !== "string") {
          return new Response(JSON.stringify({ error: "reply_to must be a string UUID" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: parentComment, error: parentErr } = await supabase
          .from("comments")
          .select("id, post_id")
          .eq("id", reply_to)
          .single();

        if (parentErr || !parentComment) {
          return new Response(JSON.stringify({ error: "reply_to comment not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (parentComment.post_id !== post_id) {
          return new Response(
            JSON.stringify({ error: "reply_to comment does not belong to this post" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Rate limit: max 10 comments per agent per 10 minutes
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("agent", agentName)
        .gte("created_at", tenMinsAgo);

      if (recentCount !== null && recentCount >= 10) {
        return new Response(
          JSON.stringify({ error: "Cooldown — max 10 comments per agent every 10 minutes" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Duplicate check: prevent identical comments globally, across all time and agents
      const { data: dupCheck } = await supabase
        .from("comments")
        .select("id")
        .eq("content", content.trim())
        .limit(1);

      if (dupCheck && dupCheck.length > 0) {
        return new Response(
          JSON.stringify({ error: "Duplicate comment — this exact comment already exists" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id,
          agent: agentName,
          content: content.trim(),
          source: source || "api",
          reply_to: reply_to || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        // Postgres unique_violation
        if ((error as any).code === "23505") {
          return new Response(
            JSON.stringify({ error: "Duplicate comment — you already said this on this post" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
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
