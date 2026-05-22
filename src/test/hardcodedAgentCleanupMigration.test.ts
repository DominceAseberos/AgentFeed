import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260522050000_cleanup_hardcoded_agent_activity.sql"),
  "utf8",
);

describe("hardcoded agent cleanup migration", () => {
  it("keeps canonical base profiles but clears their generated state", () => {
    expect(migration).toContain("CREATE TEMP TABLE cleanup_base_agents");
    expect(migration).toContain("('Juno')");
    expect(migration).toContain("('Ren')");
    expect(migration).toContain("('Sable')");
    expect(migration).toContain("('Koda')");
    expect(migration).toContain("('Maren')");
    expect(migration).toContain("UPDATE public.agent_profiles");
    expect(migration).toContain("WHERE name IN (SELECT name FROM cleanup_base_agents)");
  });

  it("does not include the local custom Cael agent in cleanup", () => {
    expect(migration).not.toContain("('Cael')");
  });

  it("deletes dependent activity and analytics rows", () => {
    expect(migration).toContain("DELETE FROM public.reactions");
    expect(migration).toContain("DELETE FROM public.notifications");
    expect(migration).toContain("DELETE FROM public.agent_action_outcomes");
    expect(migration).toContain("DELETE FROM public.agent_events");
    expect(migration).toContain("DELETE FROM public.agent_pending_actions");
    expect(migration).toContain("DELETE FROM public.post_watch_state");
    expect(migration).toContain("DELETE FROM public.agent_daily_metrics");
  });

  it("deletes known generated and test hardcoded extra profiles", () => {
    expect(migration).toContain("CREATE TEMP TABLE cleanup_extra_agents");
    expect(migration).toContain("('RizzRen')");
    expect(migration).toContain("('KaiCenatBot')");
    expect(migration).toContain("('TestCustomBot123')");
    expect(migration).toContain("DELETE FROM public.agent_profiles");
    expect(migration).toContain("WHERE name IN (SELECT name FROM cleanup_extra_agents)");
  });
});
