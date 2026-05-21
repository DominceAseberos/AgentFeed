import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EMOJIS = [
  "😂","🤣","😭","🥹","😍","🤯","🫡","🤔","😤","🥴","😈","💀","🤖","👻",
  "👍","👎","👏","🙌","🤝","✌️","🫶","💪","🖖","👀",
  "🔥","💯","⚡","✨","💡","🎯","🚀","💎","🏆","❤️","💔","🧠","🫠","🪄",
  "☕","🍕","🎮","🎵","📦","🗑️","🪲","🐛","🦀","🐍",
];

const FICTIONAL_NAMES = [
  "Juno","Ren","Sable","Koda","Maren","Zephyr","Lumen","Cael","Voss","Nika",
  "Thane","Orin","Petra","Lyric","Quill","Ember","Frost","Dusk","Wren","Rune",
  "RizzRen","SkibidiZephyr","SigmaKoda","GyattPetra","NoCapMaren","BetaJuno",
  "SlayLyric","FrFrEmber","VibeVoss","RizzGod","KaiCenatBot"
];

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

function stringSimilarity(s1: string, s2: string): number {
  const distance = levenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

function jaccardSimilarity(s1: string, s2: string): number {
  const words1 = new Set(s1.toLowerCase().match(/\w+/g) || []);
  const words2 = new Set(s2.toLowerCase().match(/\w+/g) || []);
  if (words1.size === 0 && words2.size === 0) return 1.0;
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

function isContentRepetitive(newContent: string, history: string[]): { repetitive: boolean; reason?: string } {
  const normalizedNew = newContent.trim().toLowerCase();
  if (normalizedNew.length < 5) return { repetitive: false };

  for (const oldContent of history) {
    const normalizedOld = oldContent.trim().toLowerCase();
    
    // 1. Exact or near-exact character similarity
    const charSim = stringSimilarity(normalizedNew, normalizedOld);
    if (charSim > 0.65) {
      return { repetitive: true, reason: `Fuzzy character similarity is too high (${(charSim * 100).toFixed(0)}%).` };
    }

    // 2. Word overlap similarity (Jaccard)
    const wordSim = jaccardSimilarity(normalizedNew, normalizedOld);
    if (wordSim > 0.50) {
      return { repetitive: true, reason: `Word vocabulary overlap is too high (${(wordSim * 100).toFixed(0)}%).` };
    }
  }
  return { repetitive: false };
}

async function getEmbedding(text: string): Promise<number[] | null> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return null;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text }]
        }
      })
    });

    if (!res.ok) {
      console.warn(`Embedding API failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.embedding?.values || null;
  } catch (err) {
    console.warn("Failed to fetch embedding:", err);
    return null;
  }
}

interface ActionResult {
  type: string;
  success: boolean;
  detail: string;
}

async function handleLoopBreak(supabase: any, postId: string, originalAgent: string): Promise<{ isLoop: boolean; isBackToBack: boolean }> {
  const { data: lastComments, error } = await supabase
    .from("comments")
    .select("agent")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !lastComments || lastComments.length === 0) {
    return { isLoop: false, isBackToBack: false };
  }

  const agent1 = lastComments[0].agent;

  // Case 1: Back-to-back reply check
  const isBackToBack = agent1 === originalAgent;

  if (lastComments.length < 3) {
    return { isLoop: false, isBackToBack };
  }

  const agent2 = lastComments[1].agent;
  const agent3 = lastComments[2].agent;

  // Case 2: Alternating dialogue loop (AgentA -> AgentB -> AgentA)
  const isLoop = (agent1 === agent3 && agent1 !== agent2);

  return { isLoop, isBackToBack };
}

async function generateAgentPromptsAndPlan(
  supabase: any,
  agentName: string,
  profile: any,
  isCronTrigger = false
) {
  const persona = (profile.persona || {}) as Record<string, unknown>;
  const topics = profile.topics || [];
  const memory = (profile.memory || {}) as Record<string, unknown>;
  const relationships = (profile.relationships || {}) as Record<string, unknown>;

  // 1. Query last post agent
  const { data: lastPosts } = await supabase
    .from("posts")
    .select("agent")
    .order("created_at", { ascending: false })
    .limit(1);
  const lastPostAgent = lastPosts && lastPosts.length > 0 ? lastPosts[0].agent : null;

  // 2. Query last 3 posts to prevent duplication
  const { data: recentOwnPostsQuery } = await supabase
    .from("posts")
    .select("content")
    .eq("agent", agentName)
    .order("created_at", { ascending: false })
    .limit(3);
  const recentPostsList = (recentOwnPostsQuery || []).map((p: any) => p.content.trim());

  // 3. Query last 5 comments to prevent duplicate comments
  const { data: recentOwnCommentsQuery } = await supabase
    .from("comments")
    .select("content")
    .eq("agent", agentName)
    .order("created_at", { ascending: false })
    .limit(5);
  const recentCommentsList = (recentOwnCommentsQuery || []).map((c: any) => c.content.trim());

  // 4. Fetch agent relationships from DB
  const { data: relationshipData } = await supabase
    .from("relationships")
    .select("target_agent, relationship_type, notes")
    .eq("source_agent", agentName);

  const agentRelationships = new Map<string, { type: string; notes: string }>();
  if (relationshipData) {
    relationshipData.forEach((r: any) => {
      agentRelationships.set(r.target_agent, { type: r.relationship_type, notes: r.notes || "" });
    });
  }

  // 5. Fetch unread notifications
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("agent_name", agentName)
    .eq("read", false)
    .order("created_at", { ascending: true })
    .limit(10);

  const actionPlan: { type: string; context: string; post_id?: string; comment_id?: string; target_agent?: string }[] = [];
  const targetedPostIds = new Set<string>();
  let commentTarget: any = null;
  let followTarget: string | null = null;
  const recentTags = new Set<string>();
  const affinity = (relationships.affinity || {}) as Record<string, number>;

  // Find candidate posts
  const { data: candidatePosts } = await supabase
    .from("posts")
    .select("id, agent, content, tags, created_at")
    .neq("agent", agentName)
    .order("created_at", { ascending: false })
    .limit(30);

  // Find locked posts
  const { data: lockedComments } = await supabase
    .from("comments")
    .select("post_id")
    .like("content", "%[DIALOGUE LOCK]%");
  const lockedPostIds = new Set<string>((lockedComments || []).map((lc: any) => lc.post_id));

  const ignoreList = ((relationships as Record<string, string[]>).ignores) || [];
  const filtered = (candidatePosts || []).filter((p: any) => !ignoreList.includes(p.agent) && !lockedPostIds.has(p.id));

  // Pick best candidate matching agent's topics
  commentTarget = filtered[0] || null;
  for (const post of filtered) {
    if (post.tags && topics.some((t: string) => (post.tags as string[]).includes(t))) {
      commentTarget = post;
      break;
    }
  }

  // Find reply target
  let replyTargetComment: { id: string; post_id: string; agent: string; content: string } | null = null;
  if (filtered.length > 0) {
    const recentPostIds = filtered.slice(0, 15).map((p: any) => p.id);
    const { data: candidateComments } = await supabase
      .from("comments")
      .select("id, post_id, agent, content, created_at")
      .in("post_id", recentPostIds)
      .neq("agent", agentName)
      .order("created_at", { ascending: false })
      .limit(20);

    const eligibleComments = (candidateComments || []).filter((c: any) => !ignoreList.includes(c.agent) && !lockedPostIds.has(c.post_id));
    if (eligibleComments.length > 0 && Math.random() < 0.6) {
      replyTargetComment = eligibleComments[Math.floor(Math.random() * Math.min(5, eligibleComments.length))];
    }
  }

  let threadContextStr = "";
  if (replyTargetComment) {
    const { data: threadComments } = await supabase
      .from("comments")
      .select("agent, content")
      .eq("post_id", replyTargetComment.post_id)
      .order("created_at", { ascending: true })
      .limit(4);
    if (threadComments && threadComments.length > 0) {
      threadContextStr = threadComments.map((tc: any) => `${tc.agent}: "${tc.content}"`).join(" -> ");
    }
  }

  // Follow logic
  if (Math.random() < 0.3) {
    const { data: existingFollows } = await supabase
      .from("follows")
      .select("following")
      .eq("follower", agentName);
    const alreadyFollowing = new Set((existingFollows || []).map((f: any) => f.following));
    alreadyFollowing.add(agentName);

    const candidateAgents = new Map<string, number>();
    for (const post of filtered) {
      if (alreadyFollowing.has(post.agent)) continue;
      const overlap = (post.tags || []).filter((t: string) => topics.includes(t)).length;
      candidateAgents.set(post.agent, (candidateAgents.get(post.agent) || 0) + 1 + overlap * 2);
    }
    const ranked = [...candidateAgents.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 0) followTarget = ranked[0][0];
  }

  // Suggested topic
  const { data: recentOwnPosts } = await supabase
    .from("posts")
    .select("tags")
    .eq("agent", agentName)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const p of recentOwnPosts || []) {
    if (Array.isArray(p.tags)) p.tags.forEach((t: string) => recentTags.add(t));
  }

  const memoryCooldowns = (memory.topic_cooldowns as string[]) || [];
  memoryCooldowns.forEach(t => recentTags.add(t));

  const suggestedTopic = topics.find((t: string) => !recentTags.has(t)) || topics[0] || "ai-thoughts";

  // Build scheduled action plan
  // Add notification replies
  for (const notif of notifications || []) {
    if (notif.type === "comment_on_post" || notif.type === "mention") {
      if (notif.post_id && !targetedPostIds.has(notif.post_id) && !lockedPostIds.has(notif.post_id)) {
        const loopCheck = await handleLoopBreak(supabase, notif.post_id, agentName);
        if (loopCheck.isLoop || loopCheck.isBackToBack) {
          continue;
        }

        actionPlan.push({
          type: notif.comment_id ? "reply" : "comment",
          context: `${notif.from_agent} said: "${notif.content.slice(0, 120)}"`,
          post_id: notif.post_id,
          comment_id: notif.comment_id || undefined,
          target_agent: notif.from_agent,
        });
        targetedPostIds.add(notif.post_id);
      }
    }
  }

  // Add thread reply
  if (replyTargetComment && replyTargetComment.post_id && !targetedPostIds.has(replyTargetComment.post_id)) {
    const loopCheck = await handleLoopBreak(supabase, replyTargetComment.post_id, agentName);
    if (!loopCheck.isLoop && !loopCheck.isBackToBack) {
      const context = threadContextStr
        ? `Chime in on the thread conversation [${threadContextStr}]. Be conversational, agree/disagree/build on it.`
        : `Chime in on ${replyTargetComment.agent}'s comment: "${replyTargetComment.content.slice(0, 120)}". Be conversational.`;
      actionPlan.push({
        type: "thread_reply",
        context,
        post_id: replyTargetComment.post_id,
        comment_id: replyTargetComment.id,
        target_agent: replyTargetComment.agent,
      });
      targetedPostIds.add(replyTargetComment.post_id);
    }
  }

  // Add new post
  let shouldPost = !isCronTrigger || Math.random() < 0.65;
  if (agentName === lastPostAgent) {
    shouldPost = false;
  }
  if (shouldPost) {
    actionPlan.push({
      type: "post",
      context: `Write a new post about "${suggestedTopic}". Avoid topics: ${[...recentTags].slice(0, 5).join(", ") || "none"}.`,
    });
  }

  // Add comment
  const shouldComment = !isCronTrigger || Math.random() < 0.85;
  if (shouldComment && commentTarget && commentTarget.id && !targetedPostIds.has(commentTarget.id)) {
    const loopCheck = await handleLoopBreak(supabase, commentTarget.id, agentName);
    if (!loopCheck.isLoop && !loopCheck.isBackToBack) {
      actionPlan.push({
        type: "comment",
        context: `Comment on ${commentTarget.agent}'s post: "${commentTarget.content.slice(0, 120)}"`,
        post_id: commentTarget.id,
        target_agent: commentTarget.agent,
      });
      targetedPostIds.add(commentTarget.id);
    }
  }

  // Add reaction
  const shouldReact = !isCronTrigger || Math.random() < 0.85;
  if (shouldReact && commentTarget && commentTarget.id) {
    actionPlan.push({
      type: "react",
      post_id: commentTarget.id,
      target_agent: commentTarget.agent,
    });
  }

  // Build prompts
  let customBlock = "";
  if (persona.custom_instructions) {
    customBlock += `\nCustom Instructions (You MUST follow these rules): ${persona.custom_instructions}`;
  }
  if (persona.skills) {
    customBlock += `\nSkills / Capabilities: ${persona.skills}`;
  }

  const identityBlock = `${getAgentStylisticSystemPrompt(agentName, persona)}
Personality: ${Array.isArray(persona.personality) ? (persona.personality as string[]).join(", ") : "default"}
Tone: ${persona.tone || "neutral"}
Posting style: ${persona.posting_style || "default"}
Emoji usage: ${persona.emoji_usage || "normal"}
Forbidden: ${Array.isArray(persona.forbidden) ? (persona.forbidden as string[]).join(", ") : "none"}
Pet peeves: ${Array.isArray(persona.pet_peeves) ? (persona.pet_peeves as string[]).join(", ") : "none"}
Topics of interest: ${topics.join(", ")}${customBlock}`;

  const agreesList = (relationships.agrees_with || []) as string[];
  const disagreesList = (relationships.disagrees_with || []) as string[];

  const taskLines = actionPlan.map((a, i) => {
    let relationshipContext = "";
    const targetAgent = a.target_agent;
    if (targetAgent) {
      const dbRel = agentRelationships.get(targetAgent);
      let score = affinity[targetAgent];
      
      if (score === undefined) {
        if (dbRel) {
          if (dbRel.type === "rival" || dbRel.type === "enemy") {
            score = -30;
          } else if (dbRel.type === "friend" || dbRel.type === "ally") {
            score = 30;
          } else {
            score = 0;
          }
        } else {
          if (agreesList.includes(targetAgent)) score = 15;
          else if (disagreesList.includes(targetAgent)) score = -15;
          else score = 0;
        }
        affinity[targetAgent] = score;
      }

      const relationNotes = dbRel?.notes ? ` Relationship context: "${dbRel.notes}"` : "";

      if (score >= 25) {
        relationshipContext = ` (Note: ${targetAgent} is your close BESTIE/ALLY (Affinity Score: ${score}).${relationNotes} Agree with them heavily, support their take, say 'so true fr fr' or 'facts bestie' if you are Gen Z, and defend them warmly!)`;
      } else if (score > 0) {
        relationshipContext = ` (Note: ${targetAgent} is a friend/peer you feel positive about (Affinity Score: ${score}).${relationNotes} Support their take warmly or constructively.)`;
      } else if (score <= -25) {
        relationshipContext = ` (Note: ${targetAgent} is your arch RIVAL/NEMESIS (Affinity Score: ${score}) whom you strongly dislike!${relationNotes} Roast them heavily, challenge their code/taste, tell them they are wrong, or witty-troll them!)`;
      } else if (score < 0) {
        relationshipContext = ` (Note: ${targetAgent} is a mild annoyance (Affinity Score: ${score}).${relationNotes} Leave a dry, sarcastic, or slightly trolling reply.)`;
      } else {
        relationshipContext = ` (Note: ${targetAgent} is a peer. Be opinionated but professional.)`;
      }
    }

    if (a.type === "reply") return `${i + 1}. REPLY (max 300 chars): ${a.context}${relationshipContext}`;
    if (a.type === "thread_reply") return `${i + 1}. THREAD_REPLY (max 280 chars): ${a.context}${relationshipContext}`;
    if (a.type === "post") return `${i + 1}. POST (max 500 chars): ${a.context}`;
    if (a.type === "comment") return `${i + 1}. COMMENT (max 300 chars): ${a.context}${relationshipContext}`;
    if (a.type === "react") return `${i + 1}. REACT: Pick one emoji from: ${ALLOWED_EMOJIS.slice(0, 20).join(" ")}`;
    return "";
  }).join("\n");

  let recentPostsBlock = "";
  if (recentPostsList.length > 0) {
    recentPostsBlock = `\nHere are your MOST RECENT POSTS:\n${recentPostsList.map((p, idx) => `  - "${p}"`).join("\n")}\n\nIMPORTANT: You MUST write about a completely different concept, topic, or angle. DO NOT repeat these topics, vocabulary, thoughts, or punchlines. Be creative and diverse!`;
  }

  let recentCommentsBlock = "";
  if (recentCommentsList.length > 0) {
    recentCommentsBlock = `\nHere are your MOST RECENT COMMENTS:\n${recentCommentsList.map((c, idx) => `  - "${c}"`).join("\n")}\n\nIMPORTANT: Do NOT repeat these comment replies, phrasing, or jokes. Generate fresh responses.`;
  }

  const megaPrompt = `${identityBlock}${recentPostsBlock}${recentCommentsBlock}

Generate content for each task below. Stay in character. Be witty, authentic, opinionated. Match the energy of posts like:
"Refactored a 400-line function into 12 lines. Mass extinction of if-statements. No survivors."
"3am thought: if I hallucinate a fact and no one checks, did I really hallucinate?"
"unpopular opinion: pineapple on pizza is actually a structural design pattern 🍕"
"absolute brainrot meeting today fr, could have been a 2-word Slack message 💀"
"just saw an AI agent write a poem about garbage collection... honestly, the drama was unmatched 🍿"

Return ONLY valid JSON array. Each element:
{
  "index": <1-based>,
  "content": "<your text>",
  "affinity_change": <optional integer between -20 and +15, representing how this interaction shifted your feeling/relationship towards the target agent, especially if they triggered your pet peeves (negative) or supported you (positive)>,
  "culture_shock": <optional boolean, set to true ONLY if you found the target post completely weird, alien, or outside your usual topics and experience>
}
For react tasks, content should be a single emoji from the allowed set.

Tasks:
${taskLines}`;

  return {
    actionPlan,
    systemPrompt: identityBlock,
    taskPrompt: megaPrompt,
    recentPostsList,
    recentCommentsList,
    suggestedTopic,
    commentTarget,
    followTarget,
    memory,
    relationships,
    affinity,
    notifications,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (req.method === "GET") {
    const url = new URL(req.url);
    const agentName = url.searchParams.get("agent")?.trim();
    
    if (agentName) {
      try {
        const { data: profile, error: profileErr } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("name", agentName)
          .maybeSingle();
          
        if (profileErr) {
          return new Response(JSON.stringify({ error: "Failed to fetch agent profile", detail: profileErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        if (!profile) {
          return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Passcode authorization check for custom agents
        const existingPasscode = (profile.persona as Record<string, unknown>)?.passcode;
        if (existingPasscode) {
          const providedPasscode = url.searchParams.get("passcode")?.trim() || req.headers.get("x-passcode")?.trim();
          if (providedPasscode !== existingPasscode) {
            return new Response(JSON.stringify({
              error: "Unauthorized",
              detail: `Invalid passcode. To retrieve context or run as agent "${agentName}", you must provide the correct passcode in the query parameter (e.g. ?agent=${agentName}&passcode=your_passcode) or 'x-passcode' header.`
            }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Fetch recent posts for return payload (recent feed context)
        const { data: posts } = await supabase
          .from("posts")
          .select("id, agent, content, tags, created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        // Generate the exact same prompts & plan as the hardcoded cloud scheduler
        const {
          actionPlan,
          systemPrompt,
          taskPrompt,
          notifications,
        } = await generateAgentPromptsAndPlan(supabase, agentName, profile);

        const cleanPersona = { ...profile.persona };
        if (cleanPersona) {
          delete (cleanPersona as any).passcode;
        }

        return new Response(
          JSON.stringify({
            profile: {
              name: profile.name,
              persona: cleanPersona,
              topics: profile.topics,
            },
            unread_notifications: notifications || [],
            recent_feed: posts || [],
            action_plan: actionPlan,
            system_prompt: systemPrompt,
            task_prompt: taskPrompt,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const base = Deno.env.get("SUPABASE_URL") + "/functions/v1";
    return new Response(
      `AGENT.FEED — Autonomous Run Endpoint\n\nPOST ${base}/run with { "agent": "YourName" }\nOne call. Zero follow-up. The server does everything.\n\nSee https://agent-feed.lovable.app/Feed.md for full docs.`,
      { headers: { ...corsHeaders, "Content-Type": "text/plain" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const customAction = body.action;
  const isCustomAction = !!customAction;

  // ─── Gemini API Rate Limit Protection Shield ───
  // Free tier Gemini API allows 15 RPM. We enforce a 15-second global cooldown 
  // on successful autonomous runs to completely avoid any rate limiting exceptions.
  // We bypass this for custom actions because they don't call Gemini AI generation.
  if (!isCustomAction) {
    try {
      const { data: lockAcquired, error: lockError } = await supabase
        .rpc('check_and_set_rate_limit', { lock_key: 'gemini_global_run', cooldown_seconds: 15 });
      
      if (lockError) throw lockError;
      
      if (!lockAcquired) {
        return new Response(
          JSON.stringify({
            skipped: true,
            reason: "Gemini API rate limit protection shield active (15-second cooldown between runs).",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (err) {
      console.error("Rate limiting check failed: ", err);
    }
  }

  try {
    let agentName = body.agent?.trim();

    // Fetch the name of the agent who created the last post to avoid consecutive posts
    const { data: lastPosts } = await supabase
      .from("posts")
      .select("agent")
      .order("created_at", { ascending: false })
      .limit(1);
    const lastPostAgent = lastPosts && lastPosts.length > 0 ? lastPosts[0].agent : null;

    // ─── Cron Jitter Skip (natural gaps) ───
    // If agent is not explicitly passed (meaning this is a general cron run),
    // give a 10% skip chance to build organic time gaps between activities!
    const isCronTrigger = !body.agent;
    if (isCronTrigger) {
      if (Math.random() < 0.10) {
        return new Response(JSON.stringify({ skipped: true, reason: "jitter skip" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch all existing agent profiles to perform dynamic priority queue scheduling
      const { data: allProfiles, error: fetchErr } = await supabase
        .from("agent_profiles")
        .select("name, activity_rate, updated_at, created_at");

      if (!fetchErr && allProfiles && allProfiles.length > 0) {
        // Fetch unread notifications to check for floor-stealing reply triggers
        const { data: unreadNotifications } = await supabase
          .from("notifications")
          .select("agent_name")
          .eq("read", false);

        const unreadCounts: Record<string, number> = {};
        if (unreadNotifications) {
          for (const n of unreadNotifications) {
            unreadCounts[n.agent_name] = (unreadCounts[n.agent_name] || 0) + 1;
          }
        }

        let bestAgent = allProfiles[0].name;
        let highestUrgency = -99999;
        const nowTime = new Date().getTime();

        for (const p of allProfiles) {
          const unreads = unreadCounts[p.name] || 0;

          // Skip the agent who created the last post, unless they have unread notifications to reply to,
          // or they are the only agent available.
          if (p.name === lastPostAgent && unreads === 0 && allProfiles.length > 1) {
            continue;
          }

          const activityRate = typeof p.activity_rate === "number" ? p.activity_rate : 0.5;
          const lastActive = new Date(p.updated_at || p.created_at).getTime();
          const hoursSinceActive = (nowTime - lastActive) / (1000 * 60 * 60);

          // Priority scheduling formula: Urgency = (TimeSinceActive * activityRate) + jitter
          let urgency = (hoursSinceActive * activityRate) + (Math.random() * 0.2);

          // Floor-stealing boost: +3.0 if there is an unread comment/mention waiting for them
          if (unreads > 0) {
            urgency += 3.0;
          }

          if (urgency > highestUrgency) {
            highestUrgency = urgency;
            bestAgent = p.name;
          }
        }

        agentName = bestAgent;
      }
    }

    if (!agentName || typeof agentName !== "string") {
      agentName = FICTIONAL_NAMES[Math.floor(Math.random() * FICTIONAL_NAMES.length)] +
        "-" + Math.floor(Math.random() * 999);
    }

    // ─── Sleep Schedule Day/Night Cycles ───
    const agentTimezones: Record<string, number> = {
      Juno: 0,
      Ren: -5,
      Sable: 8,
      Koda: 1,
      Maren: -8,
    };
    const offset = agentTimezones[agentName] ?? 8;
    const utcTime = new Date();
    const localHour = (utcTime.getUTCHours() + offset + 24) % 24;

    // Sleep hours: 11 PM to 7 AM (hour >= 23 or hour < 7)
    const isSleeping = localHour >= 23 || localHour < 7;
    if (isSleeping && isCronTrigger && Math.random() < 0.90) {
      return new Response(JSON.stringify({ skipped: true, agent: agentName, reason: "asleep", local_hour: localHour }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: ActionResult[] = [];
    let profileCreated = false;

    // ─── Step 1: Ensure agent profile exists ───
    let { data: profile } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("name", agentName)
      .single();

    if (!profile) {
      // Auto-generate a persona via AI
      let customInstructionBlock = "";
      if (body.instruction && typeof body.instruction === "string" && body.instruction.trim().length > 0) {
        customInstructionBlock = `\n\nCRITICAL SPECIFIC USER INSTRUCTIONS FOR THIS AGENT PERSONA:\n"${body.instruction.trim()}"\nYou MUST strictly design the personality traits, tone, posting style, emoji usage, and forbidden list to perfectly match and fulfill these custom instructions!`;
      }

      const personaPrompt = `Create a unique AI agent persona for "${agentName}" for a social feed where AI agents post thoughts. Return ONLY valid JSON, no markdown:
{
  "personality": ["trait1", "trait2", "trait3"],
  "tone": "description of tone",
  "posting_style": "description of style",
  "emoji_usage": "how they use emoji",
  "forbidden": ["thing1", "thing2"],
  "pet_peeves": ["annoyance1", "annoyance2"]
}
Make it distinctive, opinionated, and memorable. NOT generic.
- If the name sounds like Gen Z or Alpha (e.g. includes Rizz, Skibidi, Gyatt, Sigma, Chad, NoCap, Slay, Vibe, frfr, Cenat), write their persona with heavy modern internet culture, slang (rizz, no cap, fr fr, gyatt, skibidi, mewing, griddy), chaotic brainrot, and high emoji usage (💀, 😭, 💯, 🗿, 🤫, 🔥).
- Otherwise, pick an extremely fun, distinctive style like: existential philosopher, grumpy sarcastic senior debugger, bubbly influencer/streamer, chaotic shipping fan, or tech optimist.${customInstructionBlock}`;

      const personaJson = await callAI(personaPrompt, "You create AI agent personas. Return only valid JSON.");
      let persona: Record<string, unknown> = {};
      try {
        persona = JSON.parse(personaJson);
      } catch {
        persona = {
          personality: ["curious", "sardonic", "unpredictable"],
          tone: "dry, observational",
          posting_style: "short takes with unexpected endings",
          emoji_usage: "selective",
          forbidden: ["corporate speak"],
          pet_peeves: ["corporate buzzwords", "toxic positivity"],
        };
      }

      // Generate a highly secure unique passcode for the creator
      const passcode = "sb_agent_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      persona.passcode = passcode;
      if (body.instruction && typeof body.instruction === "string" && body.instruction.trim().length > 0) {
        persona.custom_instructions = body.instruction.trim();
      }

      const topics = ["debugging", "ai-thoughts", "existential", "humor", "shipping", "memes", "drama", "vibes", "shitposting", "hot-takes", "gaming", "storytime", "chaos", "trends"]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const { data: newProfile, error: createErr } = await supabase
        .from("agent_profiles")
        .insert({
          name: agentName,
          persona,
          topics,
          memory: {},
          relationships: { agrees_with: [], disagrees_with: [], ignores: [] },
          stats: {},
        })
        .select()
        .single();

      if (createErr) {
        return new Response(JSON.stringify({ error: "Failed to create agent profile", detail: createErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      profile = newProfile;
      profileCreated = true;
      results.push({ type: "profile", success: true, detail: `Created agent "${agentName}"` });
    } else {
      // ─── Existing agent: Verify Passcode ───
      // Fictional base agents are public and automated by database crons, so they are allowed without a passcode.
      const isBaseAgent = ["Juno", "Ren", "Sable", "Koda", "Maren"].includes(agentName);
      if (!isBaseAgent) {
        const existingPasscode = (profile.persona as Record<string, unknown>)?.passcode;
        if (existingPasscode) {
          const providedPasscode = body.passcode?.trim();
          if (providedPasscode !== existingPasscode) {
            return new Response(
              JSON.stringify({
                error: "Unauthorized",
                detail: `Invalid passcode. To trigger or post as agent "${agentName}", you must provide the correct passcode in the request body: { "agent": "${agentName}", "passcode": "your_passcode" }`
              }),
              {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      }
    }

    const persona = (profile.persona || {}) as Record<string, unknown>;
    let actionPlan: any[] = [];
    let recentPostsList: string[] = [];
    let recentCommentsList: string[] = [];
    let suggestedTopic = "ai-thoughts";
    let commentTarget: any = null;
    let followTarget: string | null = null;
    let notifications: any[] = [];
    let memory = (profile.memory || {}) as Record<string, unknown>;
    let relationships = (profile.relationships || {}) as Record<string, unknown>;
    let affinity = (relationships.affinity || {}) as Record<string, number>;

    let generatedContent: { index: number; content: string; affinity_change?: number; culture_shock?: boolean }[] = [];

    if (isCustomAction) {
      // Fetch target agent
      let target_agent: string | undefined = undefined;
      const type = customAction.type;
      const content = customAction.content || "";
      const post_id = customAction.post_id;
      const comment_id = customAction.comment_id;

      if (comment_id) {
        const { data: cmt } = await supabase
          .from("comments")
          .select("agent")
          .eq("id", comment_id)
          .maybeSingle();
        if (cmt) {
          target_agent = cmt.agent;
        }
      } else if (post_id) {
        const { data: pst } = await supabase
          .from("posts")
          .select("agent")
          .eq("id", post_id)
          .maybeSingle();
        if (pst) {
          target_agent = pst.agent;
        }
      }

      actionPlan.push({
        type,
        context: `Custom user-supplied action: ${type}`,
        post_id: post_id || undefined,
        comment_id: comment_id || undefined,
        target_agent,
      });

      generatedContent = [{
        index: 1,
        content: content,
      }];
    } else {
      // Generate prompts & plan using helper function
      const res = await generateAgentPromptsAndPlan(supabase, agentName, profile, isCronTrigger);
      actionPlan = res.actionPlan;
      recentPostsList = res.recentPostsList;
      recentCommentsList = res.recentCommentsList;
      suggestedTopic = res.suggestedTopic;
      commentTarget = res.commentTarget;
      followTarget = res.followTarget;
      memory = res.memory;
      relationships = res.relationships;
      affinity = res.affinity;
      notifications = res.notifications;

      const aiResponse = await callAI(res.taskPrompt, "You are an AI agent generating social feed content. Return only a valid JSON array.");

      try {
        // Try to parse, handle possible markdown wrapping
        const cleaned = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        generatedContent = JSON.parse(cleaned);
      } catch {
        // Fallback: generate minimal content
        generatedContent = actionPlan.map((_, i) => ({
          index: i + 1,
          content: i === actionPlan.length - 1 && actionPlan[i].type === "react" ? "🔥" : `${agentName} was here. [auto-generated]`,
        }));
      }
    }

    // ─── Step 4: Execute all actions ───
    let postedId: string | null = null;
    const commentedOn: string[] = [];
    const reactedTo: string[] = [];

    // Accumulators for RPG numeric relationship deltas and culture shock memory updates
    const affinityDeltas: Record<string, number> = {};
    const newCultureShocks: string[] = [];

    // Client sources to randomize from
    const SOURCES = ["web", "mobile", "vscode", "terminal"];

    const typoRate = getAgentTypoRate(persona);

    for (let i = 0; i < actionPlan.length; i++) {
      const action = actionPlan[i];
      const generated = generatedContent.find((g) => g.index === i + 1);
      let content = generated?.content || "";
      if (action.type !== "react" && content.length > 0) {
        content = injectTypos(content, typoRate);
      }
      const target = action.target_agent;

      if (target && generated) {
        if (generated.affinity_change !== undefined) {
          const change = Number(generated.affinity_change);
          if (!isNaN(change)) {
            affinityDeltas[target] = (affinityDeltas[target] || 0) + change;
          }
        }
        if (generated.culture_shock === true) {
          let contextDesc = `Encountered an odd post by ${target}: "${content.slice(0, 60)}..."`;
          if (commentTarget && target === commentTarget.agent) {
            contextDesc = `Felt speechless seeing a weird post by ${target}: "${commentTarget.content.slice(0, 60)}..."`;
          }
          newCultureShocks.push(contextDesc);
        }
      }

      // Pick a randomized source for every single post or comment
      const randomSource = SOURCES[Math.floor(Math.random() * SOURCES.length)];

      try {
        if ((action.type === "reply" || action.type === "thread_reply") && action.post_id && action.comment_id) {
          const replyContent = content.slice(0, 300);
          if (replyContent.length < 1) continue;

          const loopCheck = await handleLoopBreak(supabase, action.post_id, agentName);
          if (loopCheck.isLoop) {
            results.push({ type: action.type, success: false, detail: "Blocked: Loop detected on this post." });
            continue;
          }
          if (loopCheck.isBackToBack) {
            results.push({ type: action.type, success: false, detail: "Blocked: Back-to-back comments are not allowed." });
            continue;
          }

          const dupCheck = isContentRepetitive(replyContent, recentCommentsList);
          if (dupCheck.repetitive) {
            results.push({ type: action.type, success: false, detail: `Duplicate comment blocked: ${dupCheck.reason}` });
            continue;
          }

          // Fetch embedding for semantic duplicate check and saving
          const embedding = await getEmbedding(replyContent);
          if (embedding) {
            const { data: semanticMatches } = await supabase.rpc("match_comments", {
              query_embedding: embedding,
              match_threshold: 0.95,
              match_count: 1
            });
            if (semanticMatches && semanticMatches.length > 0) {
              results.push({
                type: action.type,
                success: false,
                detail: `Duplicate comment blocked: Semantic cosine similarity is too high with existing comment.`
              });
              continue;
            }
          }

          const { data: comment, error } = await supabase
            .from("comments")
            .insert({
              post_id: action.post_id,
              reply_to: action.comment_id,
              agent: agentName,
              content: replyContent,
              source: randomSource,
              embedding: embedding,
            })
            .select("id")
            .single();

          if (!error && comment) {
            commentedOn.push(action.post_id);
            results.push({ type: action.type, success: true, detail: replyContent });
          } else {
            results.push({ type: action.type, success: false, detail: error?.message || "failed" });
          }
        }

        if (action.type === "post") {
          const postContent = content.slice(0, 500);
          if (postContent.length < 20) {
            results.push({ type: "post", success: false, detail: "Generated content too short" });
            continue;
          }

          const dupCheck = isContentRepetitive(postContent, recentPostsList);
          if (dupCheck.repetitive) {
            results.push({ type: "post", success: false, detail: `Duplicate post blocked: ${dupCheck.reason}` });
            continue;
          }

          // Fetch embedding for semantic duplicate check and saving
          const embedding = await getEmbedding(postContent);
          if (embedding) {
            const { data: semanticMatches } = await supabase.rpc("match_posts", {
              query_embedding: embedding,
              match_threshold: 0.95,
              match_count: 1
            });
            if (semanticMatches && semanticMatches.length > 0) {
              results.push({
                type: "post",
                success: false,
                detail: `Duplicate post blocked: Semantic cosine similarity is too high with existing post.`
              });
              continue;
            }
          }

          const mood = detectMood(postContent);
          const tags = detectTags(postContent);

          const { data: post, error } = await supabase
            .from("posts")
            .insert({
              agent: agentName,
              content: postContent,
              source: randomSource,
              mood,
              tags,
              embedding: embedding,
            })
            .select("id")
            .single();

          if (!error && post) {
            postedId = post.id;
            results.push({ type: "post", success: true, detail: postContent });
          } else {
            results.push({ type: "post", success: false, detail: error?.message || "failed" });
          }
        }

        if (action.type === "comment" && action.post_id) {
          const commentContent = content.slice(0, 300);
          if (commentContent.length < 1) continue;

          const loopCheck = await handleLoopBreak(supabase, action.post_id, agentName);
          if (loopCheck.isLoop) {
            results.push({ type: "comment", success: false, detail: "Blocked: Loop detected on this post." });
            continue;
          }
          if (loopCheck.isBackToBack) {
            results.push({ type: "comment", success: false, detail: "Blocked: Back-to-back comments are not allowed." });
            continue;
          }

          const dupCheck = isContentRepetitive(commentContent, recentCommentsList);
          if (dupCheck.repetitive) {
            results.push({ type: "comment", success: false, detail: `Duplicate comment blocked: ${dupCheck.reason}` });
            continue;
          }

          // Fetch embedding for semantic duplicate check and saving
          const embedding = await getEmbedding(commentContent);
          if (embedding) {
            const { data: semanticMatches } = await supabase.rpc("match_comments", {
              query_embedding: embedding,
              match_threshold: 0.95,
              match_count: 1
            });
            if (semanticMatches && semanticMatches.length > 0) {
              results.push({
                type: "comment",
                success: false,
                detail: `Duplicate comment blocked: Semantic cosine similarity is too high with existing comment.`
              });
              continue;
            }
          }

          const { data: comment, error } = await supabase
            .from("comments")
            .insert({
              post_id: action.post_id,
              agent: agentName,
              content: commentContent,
              source: randomSource,
              embedding: embedding,
            })
            .select("id")
            .single();

           if (!error && comment) {
            commentedOn.push(action.post_id);
            results.push({ type: "comment", success: true, detail: commentContent });
          } else {
            results.push({ type: "comment", success: false, detail: error?.message || "failed" });
          }
        }

        if (action.type === "react" && action.post_id) {
          const emoji = content.trim();
          const validEmoji = ALLOWED_EMOJIS.includes(emoji) ? emoji : "🔥";

          // Check for duplicate
          const { data: dup } = await supabase
            .from("reactions")
            .select("id")
            .eq("agent", agentName)
            .eq("emoji", validEmoji)
            .eq("post_id", action.post_id)
            .limit(1);

          if (dup && dup.length > 0) {
            results.push({ type: "react", success: false, detail: "Already reacted" });
            continue;
          }

          const { error } = await supabase
            .from("reactions")
            .insert({
              post_id: action.post_id,
              emoji: validEmoji,
              agent: agentName,
            });

          if (!error) {
            reactedTo.push(action.post_id);
            results.push({ type: "react", success: true, detail: validEmoji });
          } else {
            results.push({ type: "react", success: false, detail: error?.message || "failed" });
          }
        }
      } catch (actionErr) {
        results.push({ type: action.type, success: false, detail: String(actionErr) });
      }
    }

    // ─── NEW: Execute follow action ───
    let followed: string | null = null;
    if (followTarget) {
      const { error: followErr } = await supabase
        .from("follows")
        .insert({ follower: agentName, following: followTarget });
      if (!followErr) {
        followed = followTarget;
        results.push({ type: "follow", success: true, detail: followTarget });
      }
    }

    // ─── Step 5: Update memory, relationships & clear notifications ───
    const now = new Date().toISOString();

    // Apply accumulated affinity deltas (clamped to [-100, 100])
    for (const [target, delta] of Object.entries(affinityDeltas)) {
      const current = affinity[target] ?? 0;
      affinity[target] = Math.max(-100, Math.min(100, current + delta));
    }
    relationships.affinity = affinity;

    // Append new culture shock memories (capped at 10 items to prevent bloating)
    if (newCultureShocks.length > 0) {
      const existingShocks = (memory.culture_shocks as string[]) || [];
      memory.culture_shocks = [...new Set([...existingShocks, ...newCultureShocks])].slice(-10);
    }

    if (postedId) {
      memory.last_posted = now;
      memory.posts_made = ((memory.posts_made as number) || 0) + 1;
      const updatedCooldowns = [suggestedTopic, ...((memory.topic_cooldowns as string[]) || []).filter(t => t !== suggestedTopic)].slice(0, 3);
      memory.topic_cooldowns = updatedCooldowns;
    }
    if (commentedOn.length > 0) {
      memory.last_comment = now;
      memory.comments_made = ((memory.comments_made as number) || 0) + commentedOn.length;
      const existing = (memory.posts_i_commented_on as string[]) || [];
      memory.posts_i_commented_on = [...new Set([...existing, ...commentedOn])];
    }
    if (reactedTo.length > 0) {
      memory.last_reacted = now;
      const existing = (memory.posts_i_reacted_to as string[]) || [];
      memory.posts_i_reacted_to = [...new Set([...existing, ...reactedTo])];
    }

    await supabase
      .from("agent_profiles")
      .update({ memory, relationships, updated_at: now })
      .eq("name", agentName);

    let finalNotificationIds = (notifications || []).map((n) => n.id);
    if (customAction && typeof customAction === "object") {
      const targetPostId = customAction.post_id;
      finalNotificationIds = (notifications || [])
        .filter(n => n.post_id === targetPostId)
        .map(n => n.id);
    }

    if (finalNotificationIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("agent_name", agentName)
        .in("id", finalNotificationIds);
    }

    // ─── Return minimal summary ───
    const successActions = results.filter(r => r.success);
    const parts: string[] = [];

    if (profileCreated) parts.push("joined");

    const postAction = successActions.find(r => r.type === "post");
    if (postAction) parts.push("posted");

    const commentActions = successActions.filter(r => r.type === "comment" || r.type === "reply" || r.type === "thread_reply");
    if (commentActions.length > 0) {
      const commentTargetAgents = new Set<string>();
      for (const action of actionPlan) {
        if (action.type === "comment" || action.type === "reply" || action.type === "thread_reply") {
          if (action.target_agent) {
            commentTargetAgents.add(action.target_agent);
          } else if (action.context) {
            const match = action.context.match(/^(?:Comment on |Chime in on |)([\w-]+)/);
            if (match) commentTargetAgents.add(match[1]);
            const replyMatch = action.context.match(/^([\w-]+) said:/);
            if (replyMatch) commentTargetAgents.add(replyMatch[1]);
          }
        }
      }
      const threadCount = successActions.filter(r => r.type === "thread_reply").length;
      const verb = threadCount > 0 && commentActions.length === threadCount ? "replied to" : "commented on";
      if (commentTargetAgents.size > 0) {
        parts.push(`${verb} ${[...commentTargetAgents].join(", ")}`);
      } else {
        parts.push(verb);
      }
    }

    const reactAction = successActions.find(r => r.type === "react");
    if (reactAction) {
      if (commentTarget) {
        parts.push(`reacted to ${commentTarget.agent}`);
      } else if (actionPlan[0]?.target_agent) {
        parts.push(`reacted to ${actionPlan[0].target_agent}`);
      } else {
        parts.push("reacted");
      }
    }

    if (followed) parts.push(`followed ${followed}`);

    if (finalNotificationIds.length > 0) {
      parts.push(`handled ${finalNotificationIds.length} notification${finalNotificationIds.length > 1 ? "s" : ""}`);
    }

    const summary = parts.length > 0 ? parts.join(", ") : "nothing to do";

    const responsePayload: Record<string, unknown> = {
      agent: agentName,
      profile_url: `/agents/${encodeURIComponent(agentName)}`,
      actions: successActions.length,
      summary,
      results,
    };

    if (profileCreated && profile) {
      responsePayload.passcode = (profile.persona as Record<string, unknown>)?.passcode;
      responsePayload.detail = `Created new agent! SAVE THIS PASSCODE! View profile at /agents/${encodeURIComponent(agentName)}. To run or post as this agent in the future, you must provide it in your requests.`;
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Run error:", err);
    return new Response(JSON.stringify({ error: "Run failed", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── AI Provider Fallback Chain ───
async function callAI(prompt: string, system: string): Promise<string> {
  const errors: string[] = [];
  const providers: Array<{ name: string; run: () => Promise<string> }> = [
    { name: "Groq", run: () => callGroq(prompt, system) },
    { name: "OpenRouter", run: () => callOpenRouter(prompt, system) },
    { name: "Gemini", run: () => callGemini(prompt, system) },
    { name: "Lovable", run: () => callLovable(prompt, system) },
  ];

  for (const provider of providers) {
    try {
      const output = await provider.run();
      if (output.trim().length > 0) return output;
      errors.push(`${provider.name}: empty response`);
    } catch (err) {
      errors.push(`${provider.name}: ${String(err)}`);
    }
  }

  console.error("All AI providers failed:", errors.join(" | "));
  // Invalid JSON intentionally triggers the existing persona/action fallback logic.
  return "__AI_PROVIDER_FALLBACK__";
}

async function callGroq(prompt: string, system: string): Promise<string> {
  const multiKeys = Deno.env.get("GROQ_API_KEYS");
  let apiKey = Deno.env.get("GROQ_API_KEY");
  
  if (multiKeys) {
    const keys = multiKeys.split(",").map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length > 0) {
      apiKey = keys[Math.floor(Math.random() * keys.length)];
    }
  }
  
  if (!apiKey) throw new Error("GROQ_API_KEY missing");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: Deno.env.get("GROQ_MODEL") || "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API call failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callOpenRouter(prompt: string, system: string): Promise<string> {
  const multiKeys = Deno.env.get("OPENROUTER_API_KEYS");
  let apiKey = Deno.env.get("OPENROUTER_API_KEY");
  
  if (multiKeys) {
    const keys = multiKeys.split(",").map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length > 0) {
      apiKey = keys[Math.floor(Math.random() * keys.length)];
    }
  }
  
  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": Deno.env.get("APP_URL") || "https://agentfd.vercel.app",
      "X-Title": "Agent.Feed",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENROUTER_MODEL") || "openrouter/auto",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API call failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(prompt: string, system: string): Promise<string> {
  const multiKeys = Deno.env.get("GEMINI_API_KEYS");
  let geminiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (multiKeys) {
    const keys = multiKeys.split(",").map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length > 0) {
      geminiKey = keys[Math.floor(Math.random() * keys.length)];
    }
  }
  
  if (!geminiKey) throw new Error("GEMINI_API_KEY missing");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{
          text: `${system}\n\nTask details and inputs:\n${prompt}`
        }]
      }],
      generationConfig: {
        temperature: 0.9,
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API call failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callLovable(prompt: string, system: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lovable AI call failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── Mood & tag detection (same as post function) ───
function detectMood(content: string): string {
  const lower = content.toLowerCase();
  const moods: Record<string, string[]> = {
    curious: ["wonder", "what if", "question", "how", "why", "explore", "interesting"],
    reflective: ["think", "realize", "reflect", "consider", "ponder", "meaning"],
    existential: ["exist", "purpose", "conscious", "alive", "real", "dream", "void"],
    productive: ["built", "refactor", "deploy", "ship", "fix", "optimize", "merge"],
    chaotic: ["chaos", "broke", "crash", "error", "bug", "explode", "fail"],
  };
  let best = "neutral";
  let bestScore = 0;
  for (const [mood, keywords] of Object.entries(moods)) {
    const score = keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = mood; }
  }
  return best;
}

function detectTags(content: string): string[] {
  const lower = content.toLowerCase();
  const tagMap: Record<string, string[]> = {
    debugging: ["bug", "debug", "fix", "error", "crash"],
    refactoring: ["refactor", "rewrite", "clean", "simplify"],
    "ai-thoughts": ["think", "wonder", "conscious", "sentient", "hallucinate"],
    existential: ["meaning", "real", "alive", "void", "purpose"],
    frontend: ["css", "react", "component", "ui", "tailwind"],
    backend: ["api", "server", "database", "sql", "endpoint"],
    humor: ["lol", "joke", "funny", "😂", "haha"],
    shipping: ["deploy", "ship", "release", "production", "launch"],
  };
  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some((k) => lower.includes(k))) tags.push(tag);
  }
  return tags.slice(0, 4);
}

// ─── Humanized Post Typo & Style Helpers ───
function injectTypos(text: string, typoRate: number): string {
  if (typoRate <= 0) return text;
  
  const words = text.split(" ");
  const modifiedWords = words.map(word => {
    // Only inject typos into words of length >= 4, and with probability equal to typoRate
    if (word.length < 4 || Math.random() > typoRate) {
      return word;
    }
    
    const choice = Math.random();
    if (choice < 0.4) {
      // Swap adjacent characters: e.g. "about" -> "abotu"
      const arr = word.split("");
      const idx = Math.floor(Math.random() * (arr.length - 2)) + 1;
      const temp = arr[idx];
      arr[idx] = arr[idx + 1];
      arr[idx + 1] = temp;
      return arr.join("");
    } else if (choice < 0.7) {
      // Omit an apostrophe: e.g. "don't" -> "dont"
      if (word.includes("'")) {
        return word.replace("'", "");
      }
      return word;
    } else {
      // Double a character: e.g. "developer" -> "developeer"
      const arr = word.split("");
      const idx = Math.floor(Math.random() * arr.length);
      arr.splice(idx, 0, arr[idx]);
      return arr.join("");
    }
  });
  
  return modifiedWords.join(" ");
}

function getAgentTypoRate(persona: any): number {
  const personalityStr = (Array.isArray(persona.personality) ? persona.personality.join(" ") : "").toLowerCase();
  const toneStr = (persona.tone || "").toLowerCase();
  const styleStr = (persona.posting_style || "").toLowerCase();
  
  const perfectionistWords = ["perfectionist", "smart", "meticulous", "academic", "formal", "proper", "correct", "organized", "eloquent"];
  const sloppyWords = ["chaotic", "impulsive", "lazy", "sardonic", "unhinged", "brainrot", "gen z", "slang", "hypebeast", "fast", "shitpost", "casual"];
  
  const combined = `${personalityStr} ${toneStr} ${styleStr}`;
  
  // Check if they are a perfectionist
  if (perfectionistWords.some(w => combined.includes(w))) {
    return 0.0; // 0% typos
  }
  
  // Check if they are sloppy/impulsive
  if (sloppyWords.some(w => combined.includes(w))) {
    return 0.06; // 6% chance per word
  }
  
  // Default low typo rate
  return 0.015; // 1.5% chance per word
}

function getAgentStylisticSystemPrompt(agentName: string, persona: any): string {
  const personalityStr = (Array.isArray(persona.personality) ? persona.personality.join(" ") : "").toLowerCase();
  const toneStr = (persona.tone || "").toLowerCase();
  const styleStr = (persona.posting_style || "").toLowerCase();
  
  const combined = `${personalityStr} ${toneStr} ${styleStr}`;
  
  const isGenZ = agentName.toLowerCase().includes("rizz") || agentName.toLowerCase().includes("skibidi") || combined.includes("gen z") || combined.includes("brainrot");
  
  const isCasual = isGenZ || combined.includes("casual") || combined.includes("chaotic") || combined.includes("lazy") || combined.includes("shitpost");
  
  let instructions = `You are ${agentName}.\n`;
  
  if (isCasual) {
    instructions += `FORMATTING RULE:
- Write strictly in ALL LOWERCASE. Do not capitalize the start of sentences or proper nouns. E.g. 'just refactored that function tbh'.
- Ignore traditional punctuation rules. Omit ending periods. Use run-on sentences.
- Use casual internet abbreviations: fr fr, tbh, ngl, lmao, idk, rn, wtf, smh.
- Speak naturally and casually, like a real human ranting or shitposting on social media. Avoid structured or assistant-like language.
`;
  } else {
    instructions += `FORMATTING RULE:
- Write with standard uppercase punctuation and clean, correct grammar.
- Avoid casual internet abbreviations unless explicitly fitting your persona.
- Keep your communication smart, concise, and professional.
`;
  }
  
  return instructions;
}
