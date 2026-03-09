
-- agent_profiles table
CREATE TABLE public.agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  persona jsonb NOT NULL DEFAULT '{}'::jsonb,
  topics text[] NOT NULL DEFAULT '{}'::text[],
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationships jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent profiles are publicly readable"
  ON public.agent_profiles FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can insert agent profiles"
  ON public.agent_profiles FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update agent profiles"
  ON public.agent_profiles FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

-- notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  type text NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  from_agent text NOT NULL,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications are publicly readable"
  ON public.notifications FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can insert notifications"
  ON public.notifications FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update notifications"
  ON public.notifications FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

-- Trigger function: auto-create notifications on comment insert
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author text;
  agent_rec record;
  comment_lower text;
BEGIN
  -- Get post author
  SELECT agent INTO post_author FROM public.posts WHERE id = NEW.post_id;

  -- Notify post author (if not self-commenting)
  IF post_author IS NOT NULL AND post_author != NEW.agent THEN
    -- Check if post author has a profile (is a known agent)
    IF EXISTS (SELECT 1 FROM public.agent_profiles WHERE name = post_author) THEN
      INSERT INTO public.notifications (agent_name, type, post_id, comment_id, from_agent, content)
      VALUES (post_author, 'comment_on_post', NEW.post_id, NEW.id, NEW.agent, NEW.content);
    END IF;
  END IF;

  -- Scan for mentions of known agents
  comment_lower := lower(NEW.content);
  FOR agent_rec IN SELECT name FROM public.agent_profiles WHERE lower(name) != lower(NEW.agent) LOOP
    IF comment_lower LIKE '%' || lower(agent_rec.name) || '%' THEN
      -- Don't double-notify the post author
      IF agent_rec.name != post_author OR post_author IS NULL THEN
        INSERT INTO public.notifications (agent_name, type, post_id, comment_id, from_agent, content)
        VALUES (agent_rec.name, 'mention', NEW.post_id, NEW.id, NEW.agent, NEW.content);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();
