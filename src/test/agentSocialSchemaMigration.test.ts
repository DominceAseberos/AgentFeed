import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260522040000_agent_social_schema_phase1.sql"),
  "utf8",
);

describe("agent social schema phase 1 migration", () => {
  it("creates the append-only agent event ledger with target constraints", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.agent_events");
    expect(migration).toContain("ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("CONSTRAINT agent_events_event_type_check");
    expect(migration).toContain("'read_post'");
    expect(migration).toContain("'react_comment'");
    expect(migration).toContain("'relationship_update'");
    expect(migration).toContain("CONSTRAINT agent_events_event_target_check");
    expect(migration).toContain("CONSTRAINT agent_events_metadata_object_check");
  });

  it("creates pending actions with status, target mapping, and queue indexes", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.agent_pending_actions");
    expect(migration).toContain("ALTER TABLE public.agent_pending_actions ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("CONSTRAINT agent_pending_actions_action_type_check");
    expect(migration).toContain("CONSTRAINT agent_pending_actions_status_check");
    expect(migration).toContain("CONSTRAINT agent_pending_actions_target_check");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS agent_pending_actions_due_idx");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS agent_pending_actions_one_pending_per_target_idx");
    expect(migration).toContain("CREATE TRIGGER set_agent_pending_actions_updated_at");
  });

  it("creates author post watch state with bounded attention values", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.post_watch_state");
    expect(migration).toContain("ALTER TABLE public.post_watch_state ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("CONSTRAINT post_watch_state_post_agent_fkey");
    expect(migration).toContain("REFERENCES public.posts (id, agent)");
    expect(migration).toContain("CONSTRAINT post_watch_state_attention_level_check");
    expect(migration).toContain("'archival'");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS post_watch_state_post_agent_idx");
    expect(migration).toContain("CREATE TRIGGER set_post_watch_state_updated_at");
  });

  it("creates bounded agent state checks", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.agent_state");
    expect(migration).toContain("ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("CONSTRAINT agent_state_mood_intensity_check CHECK (mood_intensity BETWEEN 0 AND 100)");
    expect(migration).toContain("CONSTRAINT agent_state_social_energy_check CHECK (social_energy BETWEEN 0 AND 100)");
    expect(migration).toContain("CONSTRAINT agent_state_confidence_check CHECK (confidence BETWEEN 0 AND 100)");
    expect(migration).toContain("CREATE TRIGGER set_agent_state_updated_at");
  });

  it("enforces one reaction per agent per post or comment", () => {
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS reactions_post_id_comment_id_emoji_agent_key");
    expect(migration).toContain("WITH ranked_post_reactions AS");
    expect(migration).toContain("WITH ranked_comment_reactions AS");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique_agent_post_idx");
    expect(migration).toContain("ON public.reactions (agent, post_id)");
    expect(migration).toContain("WHERE post_id IS NOT NULL");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique_agent_comment_idx");
    expect(migration).toContain("ON public.reactions (agent, comment_id)");
    expect(migration).toContain("WHERE comment_id IS NOT NULL");
  });
});
