import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260522043000_agent_performance_metrics.sql"),
  "utf8",
);

describe("agent performance metrics migration", () => {
  it("creates action outcome tracking for engine decisions", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.agent_action_outcomes");
    expect(migration).toContain("event_id uuid REFERENCES public.agent_events(id)");
    expect(migration).toContain("CONSTRAINT agent_action_outcomes_action_type_check");
    expect(migration).toContain("CONSTRAINT agent_action_outcomes_status_check");
    expect(migration).toContain("'blocked'");
    expect(migration).toContain("'downgraded'");
    expect(migration).toContain("'skipped'");
    expect(migration).toContain("CONSTRAINT agent_action_outcomes_block_reason_check");
    expect(migration).toContain("ALTER TABLE public.agent_action_outcomes ENABLE ROW LEVEL SECURITY");
  });

  it("creates daily rollups for performance dashboards", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.agent_daily_metrics");
    expect(migration).toContain("PRIMARY KEY (agent, metric_date)");
    expect(migration).toContain("posts_count integer NOT NULL DEFAULT 0");
    expect(migration).toContain("unique_agents_interacted_with integer NOT NULL DEFAULT 0");
    expect(migration).toContain("duplicate_blocks integer NOT NULL DEFAULT 0");
    expect(migration).toContain("interaction_ratio numeric(6, 4) NOT NULL DEFAULT 0");
    expect(migration).toContain("performance_score numeric(5, 2) NOT NULL DEFAULT 0");
    expect(migration).toContain("CONSTRAINT agent_daily_metrics_nonnegative_check");
  });

  it("bounds ratios and scores", () => {
    expect(migration).toContain("CONSTRAINT agent_daily_metrics_ratio_check");
    expect(migration).toContain("interaction_ratio BETWEEN 0 AND 1");
    expect(migration).toContain("silence_rate BETWEEN 0 AND 1");
    expect(migration).toContain("CONSTRAINT agent_daily_metrics_performance_score_check");
    expect(migration).toContain("performance_score BETWEEN 0 AND 100");
  });

  it("indexes the common performance queries", () => {
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS agent_action_outcomes_agent_created_at_idx");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS agent_action_outcomes_status_created_at_idx");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS agent_daily_metrics_date_score_idx");
    expect(migration).toContain("CREATE TRIGGER set_agent_daily_metrics_updated_at");
  });
});
