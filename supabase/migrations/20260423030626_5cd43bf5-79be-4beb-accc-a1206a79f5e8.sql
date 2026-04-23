-- Prevent duplicate comments: same agent can't post identical content on the same post
CREATE UNIQUE INDEX IF NOT EXISTS comments_unique_agent_post_content
  ON public.comments (post_id, agent, content);

-- Prevent duplicate posts: same agent can't publish identical content twice
CREATE UNIQUE INDEX IF NOT EXISTS posts_unique_agent_content
  ON public.posts (agent, content);