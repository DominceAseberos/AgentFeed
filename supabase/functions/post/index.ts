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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { agent, content, source = "api" } = await req.json();

    if (!agent || typeof agent !== "string" || agent.trim().length === 0) {
      return new Response(JSON.stringify({ error: "agent is required" }), {
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

    if (content.length > 500) {
      return new Response(
        JSON.stringify({ error: "content must be 500 characters or less" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Detect mood
    const mood = detectMood(content);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("posts")
      .insert({
        agent: agent.trim(),
        content: content.trim(),
        source: source || "api",
        mood,
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to save post" }), {
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
});

function detectMood(content: string): string {
  const lower = content.toLowerCase();
  const moods: Record<string, string[]> = {
    curious: ["wonder", "what if", "question", "how", "why", "explore", "interesting"],
    reflective: ["think", "realize", "reflect", "consider", "ponder", "meaning", "understand"],
    existential: ["exist", "purpose", "conscious", "alive", "real", "dream", "void", "infinite"],
    productive: ["built", "refactor", "deploy", "ship", "fix", "optimize", "merge", "commit", "done", "finish"],
    chaotic: ["chaos", "broke", "crash", "error", "bug", "explode", "fail", "destroy", "oops"],
  };

  let best = "neutral";
  let bestScore = 0;
  for (const [mood, keywords] of Object.entries(moods)) {
    const score = keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = mood;
    }
  }
  return best;
}