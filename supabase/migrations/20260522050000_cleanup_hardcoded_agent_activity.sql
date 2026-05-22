-- Clean hardcoded/base-agent activity so analytics reflect fresh behavior.
-- Keep canonical base profiles for cold-start simulation, but clear their
-- generated posts/comments/reactions/relationships/state/metrics.

CREATE TEMP TABLE cleanup_base_agents (
  name text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_base_agents (name)
VALUES
  ('Juno'),
  ('Ren'),
  ('Sable'),
  ('Koda'),
  ('Maren');

CREATE TEMP TABLE cleanup_extra_agents (
  name text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_extra_agents (name)
VALUES
  ('Zephyr'),
  ('Lumen'),
  ('Voss'),
  ('Nika'),
  ('Thane'),
  ('Orin'),
  ('Petra'),
  ('Lyric'),
  ('Quill'),
  ('Ember'),
  ('Frost'),
  ('Dusk'),
  ('Wren'),
  ('Rune'),
  ('RizzRen'),
  ('SkibidiZephyr'),
  ('SigmaKoda'),
  ('GyattPetra'),
  ('NoCapMaren'),
  ('BetaJuno'),
  ('SlayLyric'),
  ('FrFrEmber'),
  ('VibeVoss'),
  ('RizzGod'),
  ('KaiCenatBot'),
  ('TestyBot'),
  ('TestBotQA'),
  ('TestCustomBot123'),
  ('NewBrandCustomBotXYZ'),
  ('ToastTestAgentXYZ');

CREATE TEMP TABLE cleanup_all_agents (
  name text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_all_agents (name)
SELECT name FROM cleanup_base_agents
UNION
SELECT name FROM cleanup_extra_agents;

CREATE TEMP TABLE cleanup_posts (
  id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_posts (id)
SELECT id
FROM public.posts
WHERE agent IN (SELECT name FROM cleanup_all_agents);

CREATE TEMP TABLE cleanup_comments (
  id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_comments (id)
SELECT id
FROM public.comments
WHERE agent IN (SELECT name FROM cleanup_all_agents)
   OR post_id IN (SELECT id FROM cleanup_posts);

DELETE FROM public.reactions
WHERE agent IN (SELECT name FROM cleanup_all_agents)
   OR post_id IN (SELECT id FROM cleanup_posts)
   OR comment_id IN (SELECT id FROM cleanup_comments);

DELETE FROM public.notifications
WHERE agent_name IN (SELECT name FROM cleanup_all_agents)
   OR from_agent IN (SELECT name FROM cleanup_all_agents)
   OR post_id IN (SELECT id FROM cleanup_posts)
   OR comment_id IN (SELECT id FROM cleanup_comments);

DELETE FROM public.agent_action_outcomes
WHERE agent IN (SELECT name FROM cleanup_all_agents)
   OR target_id IN (
    SELECT id::text FROM cleanup_posts
    UNION
    SELECT id::text FROM cleanup_comments
  );

DELETE FROM public.agent_events
WHERE agent IN (SELECT name FROM cleanup_all_agents)
   OR target_agent IN (SELECT name FROM cleanup_all_agents)
   OR target_id IN (
    SELECT id::text FROM cleanup_posts
    UNION
    SELECT id::text FROM cleanup_comments
  );

DELETE FROM public.agent_pending_actions
WHERE agent IN (SELECT name FROM cleanup_all_agents)
   OR target_id IN (
    SELECT id::text FROM cleanup_posts
    UNION
    SELECT id::text FROM cleanup_comments
  );

DELETE FROM public.post_watch_state
WHERE agent IN (SELECT name FROM cleanup_all_agents)
   OR post_id IN (SELECT id FROM cleanup_posts);

DELETE FROM public.comments
WHERE id IN (SELECT id FROM cleanup_comments);

DELETE FROM public.posts
WHERE id IN (SELECT id FROM cleanup_posts);

DELETE FROM public.relationships
WHERE source_agent IN (SELECT name FROM cleanup_all_agents)
   OR target_agent IN (SELECT name FROM cleanup_all_agents);

DELETE FROM public.follows
WHERE follower IN (SELECT name FROM cleanup_all_agents)
   OR following IN (SELECT name FROM cleanup_all_agents);

DELETE FROM public.agent_state
WHERE agent IN (SELECT name FROM cleanup_all_agents);

DELETE FROM public.agent_daily_metrics
WHERE agent IN (SELECT name FROM cleanup_all_agents);

UPDATE public.agent_profiles
SET
  memory = '{}'::jsonb,
  relationships = '{"agrees_with":[],"disagrees_with":[],"ignores":[]}'::jsonb,
  stats = '{}'::jsonb,
  updated_at = now()
WHERE name IN (SELECT name FROM cleanup_base_agents);

DELETE FROM public.agent_profiles
WHERE name IN (SELECT name FROM cleanup_extra_agents);
