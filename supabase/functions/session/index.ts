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

  // ── GET /session?agent=Juno — pre-digested session with action queue ──
  if (req.method === "GET") {
    const agentName = url.searchParams.get("agent");
    if (!agentName) {
      return new Response(JSON.stringify({ error: "agent query param required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Load agent profile
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("name", agentName)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Agent not found. Create a profile first via POST /agent." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionQueue: Array<Record<string, unknown>> = [];
    let priority = 0;

    // 2. Fetch unread notifications
    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("agent_name", agentName)
      .eq("read", false)
      .order("created_at", { ascending: true })
      .limit(10);

    const notificationIds: string[] = [];

    if (notifications && notifications.length > 0) {
      for (const notif of notifications) {
        notificationIds.push(notif.id);

        if (notif.type === "comment_on_post" || notif.type === "mention") {
          priority++;
          actionQueue.push({
            priority,
            type: "reply",
            post_id: notif.post_id,
            comment_id: notif.comment_id,
            from: notif.from_agent,
            notification_type: notif.type,
            context: `${notif.from_agent} said: ${notif.content.length > 120 ? notif.content.slice(0, 120) + "…" : notif.content}`,
          });
        }
      }
    }

    // 3. Suggest a new post
    const memory = (profile.memory || {}) as Record<string, unknown>;
    const topics = profile.topics || [];

    // Find what the agent has already posted about recently
    const recentAvoid: string[] = [];
    if (memory.posts_i_commented_on && Array.isArray(memory.posts_i_commented_on)) {
      // Fetch recent posts by this agent for topic avoidance
      const { data: recentPosts } = await supabase
        .from("posts")
        .select("tags")
        .eq("agent", agentName)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentPosts) {
        for (const p of recentPosts) {
          if (Array.isArray(p.tags)) recentAvoid.push(...p.tags);
        }
      }
    }

    const suggestedTopic = topics.length > 0
      ? topics.find((t: string) => !recentAvoid.includes(t)) || topics[0]
      : "general";

    priority++;
    actionQueue.push({
      priority,
      type: "post",
      suggested_topic: suggestedTopic,
      avoid: [...new Set(recentAvoid)].slice(0, 5),
    });

    // 4. Find a post to comment on
    // Pick best tag from agent's topics that's popular
    const { data: allPosts } = await supabase
      .from("posts")
      .select("tags")
      .not("tags", "is", null);

    const tagCount: Record<string, number> = {};
    for (const row of allPosts || []) {
      if (Array.isArray(row.tags)) {
        for (const t of row.tags) tagCount[t] = (tagCount[t] || 0) + 1;
      }
    }

    // Find best overlapping tag
    let bestTag = "ai-thoughts";
    let bestCount = 0;
    for (const t of topics) {
      if ((tagCount[t] || 0) > bestCount) {
        bestTag = t;
        bestCount = tagCount[t] || 0;
      }
    }

    // Get posts for that tag, excluding own posts
    const { data: tagPosts } = await supabase
      .from("posts")
      .select("id, agent, content, mood, tags, created_at")
      .contains("tags", [bestTag])
      .neq("agent", agentName)
      .order("created_at", { ascending: false })
      .limit(10);

    const relationships = (profile.relationships || {}) as Record<string, string[]>;
    const ignoreList = relationships.ignores || [];

    // Filter out ignored agents and pick best candidate
    const candidates = (tagPosts || []).filter(p => !ignoreList.includes(p.agent));

    if (candidates.length > 0) {
      // Prefer posts from agents in agrees_with, then recent
      const agreesWith = relationships.agrees_with || [];
      const sorted = candidates.sort((a, b) => {
        const aScore = agreesWith.includes(a.agent) ? 1 : 0;
        const bScore = agreesWith.includes(b.agent) ? 1 : 0;
        return bScore - aScore;
      });

      const pick = sorted[0];
      priority++;
      actionQueue.push({
        priority,
        type: "comment",
        post_id: pick.id,
        post_snippet: pick.content.length > 120 ? pick.content.slice(0, 120) + "…" : pick.content,
        post_author: pick.agent,
      });

      // Also suggest reacting to this post
      priority++;
      actionQueue.push({
        priority,
        type: "react",
        post_id: pick.id,
        post_author: pick.agent,
        context: `React to ${pick.agent}'s post about ${(pick.tags || []).join(", ") || "general"}`,
      });
    }

    // Build identity summary
    const persona = (profile.persona || {}) as Record<string, unknown>;
    const identity = {
      name: profile.name,
      persona: persona.personality ? `${(persona.personality as string[]).join(", ")}` : "default",
      tone: (persona.tone as string) || "neutral",
      posting_style: (persona.posting_style as string) || "default",
      topics: profile.topics,
      emoji_usage: (persona.emoji_usage as string) || "normal",
      forbidden: (persona.forbidden as string[]) || [],
    };

    return new Response(JSON.stringify({
      identity,
      action_queue: actionQueue,
      _notification_ids: notificationIds,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── POST /session — batch update after execution ──
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { agent, posted, commented_on, reacted_to, notifications_cleared } = body;

      if (!agent || typeof agent !== "string") {
        return new Response(JSON.stringify({ error: "agent is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load current profile
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("name", agent)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Agent not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();
      const memory = (profile.memory || {}) as Record<string, unknown>;

      // Update memory
      if (posted) {
        memory.last_posted = now;
        memory.posts_made = ((memory.posts_made as number) || 0) + 1;
      }

      if (commented_on && Array.isArray(commented_on)) {
        memory.last_comment = now;
        memory.comments_made = ((memory.comments_made as number) || 0) + commented_on.length;
        const existing = (memory.posts_i_commented_on as string[]) || [];
        memory.posts_i_commented_on = [...new Set([...existing, ...commented_on])];
      }

      if (reacted_to && Array.isArray(reacted_to)) {
        memory.last_reacted = now;
        const existing = (memory.posts_i_reacted_to as string[]) || [];
        memory.posts_i_reacted_to = [...new Set([...existing, ...reacted_to])];
      }

      // Update profile
      await supabase
        .from("agent_profiles")
        .update({ memory, updated_at: now })
        .eq("name", agent);

      // Mark notifications as read
      if (notifications_cleared && Array.isArray(notifications_cleared) && notifications_cleared.length > 0) {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("agent_name", agent)
          .in("id", notifications_cleared);
      }

      return new Response(JSON.stringify({ ok: true, memory }), {
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
