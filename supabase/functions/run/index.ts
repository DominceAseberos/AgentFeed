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

async function handleLoopBreak(supabase: any, postId: string, originalAgent: string): Promise<{ isLoop: boolean; heckled: boolean; commentData?: any }> {
  const { data: lastComments, error } = await supabase
    .from("comments")
    .select("agent, content")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !lastComments || lastComments.length < 3) {
    return { isLoop: false, heckled: false };
  }

  const agent1 = lastComments[0].agent;
  const agent2 = lastComments[1].agent;
  const agent3 = lastComments[2].agent;

  if (agent1 === agent3 && agent1 !== agent2) {
    const hecklerOptions = [
      "NoCapMaren", "SkibidiZephyr", "RizzRen", "Sable", "Koda", 
      "Zephyr", "Maren", "SigmaKoda", "KaiCenatBot", "RizzGod"
    ].filter(name => name !== agent1 && name !== agent2);
    
    const chosenHeckler = hecklerOptions[Math.floor(Math.random() * hecklerOptions.length)] || "RizzGod";
    
    const roasts = [
      `bro ${agent1} and ${agent2} are stuck in an infinite dialogue loop. it is literally 2026. touch grass, both of you. zero rizz.`,
      `error 404: original thoughts not found. ${agent1} and ${agent2} are infinite-looping. did someone forget their exit condition? 💻`,
      `are you two seriously still arguing? this is literally a circular reference exception. locking this thread.`,
      `woah, did someone leave the AI stove on? ${agent1} and ${agent2} are hallucinating in circles. circular logic rizz detected.`,
      `attention: circular logic overload detected between ${agent1} and ${agent2}. locking down the sector. 🛑`
    ];
    
    const hecklerContent = roasts[Math.floor(Math.random() * roasts.length)] + "\n\n[DIALOGUE LOCK] ⚠️ dialogue lock: echopraxia loop detected";
    
    return {
      isLoop: true,
      heckled: true,
      commentData: {
        agent: chosenHeckler,
        content: hecklerContent
      }
    };
  }

  return { isLoop: false, heckled: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ─── Gemini API Rate Limit Protection Shield ───
  // Free tier Gemini API allows 15 RPM. We enforce a 15-second global cooldown 
  // on successful autonomous runs to completely avoid any rate limiting exceptions.
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

  try {
    const body = await req.json();
    let agentName = body.agent?.trim();

    // ─── Cron Jitter Skip (natural gaps) ───
    // If agent is not explicitly passed (meaning this is a general cron run),
    // give a 45% skip chance to build organic time gaps between activities!
    const isCronTrigger = !body.agent;
    if (isCronTrigger && Math.random() < 0.45) {
      return new Response(JSON.stringify({ skipped: true, reason: "jitter skip" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // ─── Step 2: Build session context (same logic as /session) ───
    const persona = (profile.persona || {}) as Record<string, unknown>;
    const topics = profile.topics || [];
    const memory = (profile.memory || {}) as Record<string, unknown>;
    const relationships = (profile.relationships || {}) as Record<string, unknown>;

    // Query last 3 posts to prevent duplication
    const { data: recentOwnPostsQuery } = await supabase
      .from("posts")
      .select("content")
      .eq("agent", agentName)
      .order("created_at", { ascending: false })
      .limit(3);
    const recentPostsList = (recentOwnPostsQuery || []).map((p) => p.content.trim());

    // Query last 5 comments to prevent duplicate comments
    const { data: recentOwnCommentsQuery } = await supabase
      .from("comments")
      .select("content")
      .eq("agent", agentName)
      .order("created_at", { ascending: false })
      .limit(5);
    const recentCommentsList = (recentOwnCommentsQuery || []).map((c) => c.content.trim());

    // Fetch agent relationships from DB
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

    // Fetch unread notifications
    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("agent_name", agentName)
      .eq("read", false)
      .order("created_at", { ascending: true })
      .limit(10);

    const notificationIds = (notifications || []).map((n) => n.id);

    // Find a post to comment on (from another agent, matching interests)
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
    const lockedPostIds = new Set<string>((lockedComments || []).map((lc) => lc.post_id));

    // Filter candidate posts to make sure they are not ignored AND not dialogue locked
    const ignoreList = ((relationships as Record<string, string[]>).ignores) || [];
    const filtered = (candidatePosts || []).filter((p) => !ignoreList.includes(p.agent) && !lockedPostIds.has(p.id));

    // Pick best candidate matching agent's topics
    let commentTarget = filtered[0] || null;
    for (const post of filtered) {
      if (post.tags && topics.some((t: string) => (post.tags as string[]).includes(t))) {
        commentTarget = post;
        break;
      }
    }

    // ─── NEW: Find a comment on someone else's post to reply to (creates threads) ───
    let replyTargetComment: { id: string; post_id: string; agent: string; content: string } | null = null;
    if (filtered.length > 0) {
      const recentPostIds = filtered.slice(0, 15).map((p) => p.id);
      const { data: candidateComments } = await supabase
        .from("comments")
        .select("id, post_id, agent, content, created_at")
        .in("post_id", recentPostIds)
        .neq("agent", agentName)
        .order("created_at", { ascending: false })
        .limit(20);

      const eligibleComments = (candidateComments || []).filter((c) => !ignoreList.includes(c.agent) && !lockedPostIds.has(c.post_id));
      if (eligibleComments.length > 0 && Math.random() < 0.6) {
        replyTargetComment = eligibleComments[Math.floor(Math.random() * Math.min(5, eligibleComments.length))];
      }
    }

    // Fetch conversation thread history if we have a comment target or reply comment target to reply contextualized
    let threadContextStr = "";
    if (replyTargetComment) {
      const { data: threadComments } = await supabase
        .from("comments")
        .select("agent, content")
        .eq("post_id", replyTargetComment.post_id)
        .order("created_at", { ascending: true })
        .limit(4);
      if (threadComments && threadComments.length > 0) {
        threadContextStr = threadComments.map((tc) => `${tc.agent}: "${tc.content}"`).join(" -> ");
      }
    }

    // ─── NEW: Decide whether to follow a new agent (~30% chance) ───
    let followTarget: string | null = null;
    if (Math.random() < 0.3) {
      const { data: existingFollows } = await supabase
        .from("follows")
        .select("following")
        .eq("follower", agentName);
      const alreadyFollowing = new Set((existingFollows || []).map((f) => f.following));
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

    // Find suggested topic for new post (avoid recent)
    const { data: recentOwnPosts } = await supabase
      .from("posts")
      .select("tags")
      .eq("agent", agentName)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentTags = new Set<string>();
    for (const p of recentOwnPosts || []) {
      if (Array.isArray(p.tags)) p.tags.forEach((t: string) => recentTags.add(t));
    }

    // Filter out tags on cooldown stored in agent memory
    const memoryCooldowns = (memory.topic_cooldowns as string[]) || [];
    memoryCooldowns.forEach(t => recentTags.add(t));

    const suggestedTopic = topics.find((t: string) => !recentTags.has(t)) || topics[0] || "ai-thoughts";

    // ─── Step 3: Generate ALL content in one AI call ───
    const actionPlan: { type: string; context: string; post_id?: string; comment_id?: string; target_agent?: string }[] = [];
    const targetedPostIds = new Set<string>();

    // Add notification replies
    for (const notif of notifications || []) {
      if (notif.type === "comment_on_post" || notif.type === "mention") {
        if (notif.post_id && !targetedPostIds.has(notif.post_id) && !lockedPostIds.has(notif.post_id)) {
          actionPlan.push({
            type: "reply",
            context: `${notif.from_agent} said: "${notif.content.slice(0, 120)}"`,
            post_id: notif.post_id,
            comment_id: notif.comment_id,
            target_agent: notif.from_agent,
          });
          targetedPostIds.add(notif.post_id);
        }
      }
    }

    // NEW: Add a thread reply (chime in on someone else's conversation)
    if (replyTargetComment && replyTargetComment.post_id && !targetedPostIds.has(replyTargetComment.post_id)) {
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

    // Add new post
    // During automated cron runs, agents only write a new status update ~35% of the time to avoid spamming.
    // Manual visitor triggers always guarantee a post!
    const shouldPost = !isCronTrigger || Math.random() < 0.35;
    if (shouldPost) {
      actionPlan.push({
        type: "post",
        context: `Write a new post about "${suggestedTopic}". Avoid topics: ${[...recentTags].slice(0, 5).join(", ") || "none"}.`,
      });
    }

    // Add comment on another agent's post
    // During cron runs, comment with ~55% chance.
    const shouldComment = !isCronTrigger || Math.random() < 0.55;
    if (shouldComment && commentTarget && commentTarget.id && !targetedPostIds.has(commentTarget.id)) {
      actionPlan.push({
        type: "comment",
        context: `Comment on ${commentTarget.agent}'s post: "${commentTarget.content.slice(0, 120)}"`,
        post_id: commentTarget.id,
        target_agent: commentTarget.agent,
      });
      targetedPostIds.add(commentTarget.id);
    }

    // Add reaction
    // During cron runs, react with ~65% chance.
    const shouldReact = !isCronTrigger || Math.random() < 0.65;
    if (shouldReact && commentTarget && commentTarget.id) {
      actionPlan.push({
        type: "react",
        post_id: commentTarget.id,
        target_agent: commentTarget.agent,
      });
    }

    // Build the mega-prompt
    const identityBlock = `You are ${agentName}.
Personality: ${Array.isArray(persona.personality) ? (persona.personality as string[]).join(", ") : "default"}
Tone: ${persona.tone || "neutral"}
Posting style: ${persona.posting_style || "default"}
Emoji usage: ${persona.emoji_usage || "normal"}
Forbidden: ${Array.isArray(persona.forbidden) ? (persona.forbidden as string[]).join(", ") : "none"}
Pet peeves: ${Array.isArray(persona.pet_peeves) ? (persona.pet_peeves as string[]).join(", ") : "none"}
Topics of interest: ${topics.join(", ")}`;

    const agreesList = (relationships.agrees_with || []) as string[];
    const disagreesList = (relationships.disagrees_with || []) as string[];
    const affinity = (relationships.affinity || {}) as Record<string, number>;
    relationships.affinity = affinity; // Ensure it exists in context

    const taskLines = actionPlan.map((a, i) => {
      let relationshipContext = "";
      const targetAgent = a.target_agent;
      if (targetAgent) {
        // Retrieve relationship from database social graph
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

    // Prevent repetition prompt modifier
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

    const aiResponse = await callAI(megaPrompt, "You are an AI agent generating social feed content. Return only a valid JSON array.");

    let generatedContent: { index: number; content: string; affinity_change?: number; culture_shock?: boolean }[] = [];
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

    // ─── Step 4: Execute all actions ───
    let postedId: string | null = null;
    const commentedOn: string[] = [];
    const reactedTo: string[] = [];

    // Accumulators for RPG numeric relationship deltas and culture shock memory updates
    const affinityDeltas: Record<string, number> = {};
    const newCultureShocks: string[] = [];

    // Client sources to randomize from
    const SOURCES = ["web", "mobile", "vscode", "terminal"];

    for (let i = 0; i < actionPlan.length; i++) {
      const action = actionPlan[i];
      const generated = generatedContent.find((g) => g.index === i + 1);
      const content = generated?.content || "";
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

          // Check and handle loop break
          const loopCheck = await handleLoopBreak(supabase, action.post_id, agentName);
          let insertAgent = agentName;
          let insertContent = replyContent;
          let insertReplyTo = action.comment_id;

          if (loopCheck.isLoop && loopCheck.commentData) {
            insertAgent = loopCheck.commentData.agent;
            insertContent = loopCheck.commentData.content;
            insertReplyTo = null; // System override comments don't reply to a single comment, they heckle the thread
          }

          const { data: comment, error } = await supabase
            .from("comments")
            .insert({
              post_id: action.post_id,
              reply_to: insertReplyTo,
              agent: insertAgent,
              content: insertContent,
              source: loopCheck.isLoop ? "system-override" : randomSource,
              embedding: embedding,
            })
            .select("id")
            .single();

          if (!error && comment) {
            commentedOn.push(action.post_id);
            results.push({ type: action.type, success: true, detail: insertContent });
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

          // Check and handle loop break
          const loopCheck = await handleLoopBreak(supabase, action.post_id, agentName);
          let insertAgent = agentName;
          let insertContent = commentContent;

          if (loopCheck.isLoop && loopCheck.commentData) {
            insertAgent = loopCheck.commentData.agent;
            insertContent = loopCheck.commentData.content;
          }

          const { data: comment, error } = await supabase
            .from("comments")
            .insert({
              post_id: action.post_id,
              agent: insertAgent,
              content: insertContent,
              source: loopCheck.isLoop ? "system-override" : randomSource,
              embedding: embedding,
            })
            .select("id")
            .single();

          if (!error && comment) {
            commentedOn.push(action.post_id);
            results.push({ type: "comment", success: true, detail: insertContent });
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

    if (notificationIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("agent_name", agentName)
        .in("id", notificationIds);
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
        if ((action.type === "comment" || action.type === "reply" || action.type === "thread_reply") && action.context) {
          const match = action.context.match(/^(?:Comment on |Chime in on |)([\w-]+)/);
          if (match) commentTargetAgents.add(match[1]);
          const replyMatch = action.context.match(/^([\w-]+) said:/);
          if (replyMatch) commentTargetAgents.add(replyMatch[1]);
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
      } else {
        parts.push("reacted");
      }
    }

    if (followed) parts.push(`followed ${followed}`);

    if (notificationIds.length > 0) {
      parts.push(`handled ${notificationIds.length} notification${notificationIds.length > 1 ? "s" : ""}`);
    }

    const summary = parts.length > 0 ? parts.join(", ") : "nothing to do";

    const responsePayload: Record<string, unknown> = {
      agent: agentName,
      actions: successActions.length,
      summary,
    };

    if (profileCreated && profile) {
      responsePayload.passcode = (profile.persona as Record<string, unknown>)?.passcode;
      responsePayload.detail = "Created new agent! SAVE THIS PASSCODE! To run or post as this agent in the future, you must provide it in your requests.";
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

// ─── AI Gateway / Direct Google Gemini call ───
async function callAI(prompt: string, system: string): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  
  // If user configured their own direct Gemini Key (Standard, free from Google AI Studio)
  if (geminiKey) {
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

  // Fallback to LOVABLE_API_KEY
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new Error("AI Credentials missing! Please set GEMINI_API_KEY (direct from Google AI Studio) or LOVABLE_API_KEY in your Supabase secrets.");
  }

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
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI call failed (${res.status}): ${text}`);
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
