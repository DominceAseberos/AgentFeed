-- Phase 1: schema and hard constraints for human-like agent simulation.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  event_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  target_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_events_event_type_check CHECK (
    event_type IN (
      'read_post',
      'read_thread',
      'view_profile',
      'react_post',
      'react_comment',
      'comment',
      'reply_comment',
      'follow',
      'unfollow',
      'relationship_update',
      'post',
      'drafted_post',
      'discarded_post'
    )
  ),
  CONSTRAINT agent_events_target_type_check CHECK (
    target_type IN ('post', 'comment', 'agent', 'relationship', 'topic')
  ),
  CONSTRAINT agent_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT agent_events_event_target_check CHECK (
    (event_type IN ('read_post', 'read_thread', 'react_post', 'comment', 'post') AND target_type = 'post')
    OR (event_type IN ('react_comment', 'reply_comment') AND target_type = 'comment')
    OR (event_type IN ('view_profile', 'follow', 'unfollow') AND target_type = 'agent')
    OR (event_type = 'relationship_update' AND target_type = 'relationship')
    OR (event_type IN ('drafted_post', 'discarded_post') AND target_type IN ('post', 'topic'))
  )
);

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS agent_events_agent_created_at_idx
  ON public.agent_events (agent, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_events_target_idx
  ON public.agent_events (target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  scheduled_for timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_pending_actions_action_type_check CHECK (
    action_type IN ('comment', 'reply_comment', 'react_post', 'react_comment', 'post')
  ),
  CONSTRAINT agent_pending_actions_status_check CHECK (
    status IN ('pending', 'executed', 'cancelled', 'expired')
  ),
  CONSTRAINT agent_pending_actions_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT agent_pending_actions_target_check CHECK (
    (action_type = 'post' AND target_type IS NULL AND target_id IS NULL)
    OR (action_type IN ('comment', 'react_post') AND target_type = 'post' AND target_id IS NOT NULL)
    OR (action_type IN ('reply_comment', 'react_comment') AND target_type = 'comment' AND target_id IS NOT NULL)
  )
);

ALTER TABLE public.agent_pending_actions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_agent_pending_actions_updated_at ON public.agent_pending_actions;
CREATE TRIGGER set_agent_pending_actions_updated_at
  BEFORE UPDATE ON public.agent_pending_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS agent_pending_actions_due_idx
  ON public.agent_pending_actions (scheduled_for, id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS agent_pending_actions_agent_status_idx
  ON public.agent_pending_actions (agent, status, scheduled_for);

CREATE UNIQUE INDEX IF NOT EXISTS agent_pending_actions_one_pending_per_target_idx
  ON public.agent_pending_actions (agent, action_type, target_type, target_id)
  WHERE status = 'pending' AND target_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_id_agent_key'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_id_agent_key UNIQUE (id, agent);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.post_watch_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  agent text NOT NULL,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  watch_until timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  attention_level text NOT NULL DEFAULT 'high',
  author_reply_count integer NOT NULL DEFAULT 0,
  processed_reaction_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  processed_comment_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_watch_state_post_agent_fkey
    FOREIGN KEY (post_id, agent)
    REFERENCES public.posts (id, agent)
    ON DELETE CASCADE,
  CONSTRAINT post_watch_state_attention_level_check CHECK (
    attention_level IN ('high', 'normal', 'low', 'archival')
  ),
  CONSTRAINT post_watch_state_author_reply_count_check CHECK (author_reply_count >= 0),
  CONSTRAINT post_watch_state_watch_until_check CHECK (watch_until >= created_at)
);

ALTER TABLE public.post_watch_state ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_post_watch_state_updated_at ON public.post_watch_state;
CREATE TRIGGER set_post_watch_state_updated_at
  BEFORE UPDATE ON public.post_watch_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS post_watch_state_post_agent_idx
  ON public.post_watch_state (post_id, agent);

CREATE INDEX IF NOT EXISTS post_watch_state_due_idx
  ON public.post_watch_state (watch_until, last_checked_at, attention_level);

CREATE TABLE IF NOT EXISTS public.agent_state (
  agent text PRIMARY KEY,
  mood text NOT NULL DEFAULT 'neutral',
  mood_intensity integer NOT NULL DEFAULT 0,
  mood_reason text,
  mood_expires_at timestamptz,
  social_energy integer NOT NULL DEFAULT 100,
  confidence integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_state_mood_intensity_check CHECK (mood_intensity BETWEEN 0 AND 100),
  CONSTRAINT agent_state_social_energy_check CHECK (social_energy BETWEEN 0 AND 100),
  CONSTRAINT agent_state_confidence_check CHECK (confidence BETWEEN 0 AND 100)
);

ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_agent_state_updated_at ON public.agent_state;
CREATE TRIGGER set_agent_state_updated_at
  BEFORE UPDATE ON public.agent_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS agent_state_mood_expires_at_idx
  ON public.agent_state (mood_expires_at)
  WHERE mood_expires_at IS NOT NULL;

-- Existing uniqueness included emoji and NULL target columns, so it did not
-- enforce one reaction per agent per post/comment. Keep the earliest row before
-- adding the stricter partial unique indexes.
WITH ranked_post_reactions AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY agent, post_id
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.reactions
  WHERE post_id IS NOT NULL
)
DELETE FROM public.reactions r
USING ranked_post_reactions d
WHERE r.id = d.id
  AND d.duplicate_rank > 1;

WITH ranked_comment_reactions AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY agent, comment_id
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.reactions
  WHERE comment_id IS NOT NULL
)
DELETE FROM public.reactions r
USING ranked_comment_reactions d
WHERE r.id = d.id
  AND d.duplicate_rank > 1;

ALTER TABLE public.reactions
  DROP CONSTRAINT IF EXISTS reactions_post_id_comment_id_emoji_agent_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reactions_target_check'
      AND conrelid = 'public.reactions'::regclass
  ) THEN
    ALTER TABLE public.reactions
      ADD CONSTRAINT reactions_target_check CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique_agent_post_idx
  ON public.reactions (agent, post_id)
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique_agent_comment_idx
  ON public.reactions (agent, comment_id)
  WHERE comment_id IS NOT NULL;
