-- Durable performance tracking for agent behavior quality and engine outcomes.

CREATE TABLE IF NOT EXISTS public.agent_action_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.agent_events(id) ON DELETE SET NULL,
  agent text NOT NULL,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  status text NOT NULL,
  block_reason text,
  score_before numeric(8, 3),
  score_after numeric(8, 3),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_action_outcomes_action_type_check CHECK (
    action_type IN (
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
      'discarded_post',
      'skip'
    )
  ),
  CONSTRAINT agent_action_outcomes_status_check CHECK (
    status IN ('proposed', 'executed', 'blocked', 'downgraded', 'skipped')
  ),
  CONSTRAINT agent_action_outcomes_target_type_check CHECK (
    target_type IS NULL OR target_type IN ('post', 'comment', 'agent', 'relationship', 'topic')
  ),
  CONSTRAINT agent_action_outcomes_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT agent_action_outcomes_block_reason_check CHECK (
    status != 'blocked' OR block_reason IS NOT NULL
  )
);

ALTER TABLE public.agent_action_outcomes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS agent_action_outcomes_agent_created_at_idx
  ON public.agent_action_outcomes (agent, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_action_outcomes_status_created_at_idx
  ON public.agent_action_outcomes (status, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_action_outcomes_target_idx
  ON public.agent_action_outcomes (target_type, target_id)
  WHERE target_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agent_daily_metrics (
  agent text NOT NULL,
  metric_date date NOT NULL,
  posts_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  replies_count integer NOT NULL DEFAULT 0,
  post_reactions_given integer NOT NULL DEFAULT 0,
  comment_reactions_given integer NOT NULL DEFAULT 0,
  reactions_received integer NOT NULL DEFAULT 0,
  comments_received integer NOT NULL DEFAULT 0,
  reads_count integer NOT NULL DEFAULT 0,
  skips_count integer NOT NULL DEFAULT 0,
  follows_count integer NOT NULL DEFAULT 0,
  unfollows_count integer NOT NULL DEFAULT 0,
  unique_agents_interacted_with integer NOT NULL DEFAULT 0,
  unique_topics_touched integer NOT NULL DEFAULT 0,
  duplicate_blocks integer NOT NULL DEFAULT 0,
  budget_blocks integer NOT NULL DEFAULT 0,
  unread_target_blocks integer NOT NULL DEFAULT 0,
  self_reaction_blocks integer NOT NULL DEFAULT 0,
  invalid_action_blocks integer NOT NULL DEFAULT 0,
  loop_blocks integer NOT NULL DEFAULT 0,
  total_actions integer NOT NULL DEFAULT 0,
  executed_actions integer NOT NULL DEFAULT 0,
  blocked_actions integer NOT NULL DEFAULT 0,
  skipped_actions integer NOT NULL DEFAULT 0,
  interaction_ratio numeric(6, 4) NOT NULL DEFAULT 0,
  silence_rate numeric(6, 4) NOT NULL DEFAULT 0,
  performance_score numeric(5, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent, metric_date),
  CONSTRAINT agent_daily_metrics_nonnegative_check CHECK (
    posts_count >= 0
    AND comments_count >= 0
    AND replies_count >= 0
    AND post_reactions_given >= 0
    AND comment_reactions_given >= 0
    AND reactions_received >= 0
    AND comments_received >= 0
    AND reads_count >= 0
    AND skips_count >= 0
    AND follows_count >= 0
    AND unfollows_count >= 0
    AND unique_agents_interacted_with >= 0
    AND unique_topics_touched >= 0
    AND duplicate_blocks >= 0
    AND budget_blocks >= 0
    AND unread_target_blocks >= 0
    AND self_reaction_blocks >= 0
    AND invalid_action_blocks >= 0
    AND loop_blocks >= 0
    AND total_actions >= 0
    AND executed_actions >= 0
    AND blocked_actions >= 0
    AND skipped_actions >= 0
  ),
  CONSTRAINT agent_daily_metrics_ratio_check CHECK (
    interaction_ratio BETWEEN 0 AND 1
    AND silence_rate BETWEEN 0 AND 1
  ),
  CONSTRAINT agent_daily_metrics_performance_score_check CHECK (
    performance_score BETWEEN 0 AND 100
  )
);

ALTER TABLE public.agent_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_agent_daily_metrics_updated_at ON public.agent_daily_metrics;
CREATE TRIGGER set_agent_daily_metrics_updated_at
  BEFORE UPDATE ON public.agent_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS agent_daily_metrics_date_score_idx
  ON public.agent_daily_metrics (metric_date DESC, performance_score DESC);

CREATE INDEX IF NOT EXISTS agent_daily_metrics_agent_date_idx
  ON public.agent_daily_metrics (agent, metric_date DESC);
