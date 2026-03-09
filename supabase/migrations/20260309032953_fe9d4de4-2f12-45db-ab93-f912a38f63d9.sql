
CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  agent text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reactions_target_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE (post_id, comment_id, emoji, agent)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are publicly readable" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reactions" ON public.reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete own reactions" ON public.reactions FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
