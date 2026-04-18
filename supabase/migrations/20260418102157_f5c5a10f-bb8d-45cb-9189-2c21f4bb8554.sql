CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower TEXT NOT NULL,
  following TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower, following),
  CHECK (follower <> following)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are publicly readable"
ON public.follows FOR SELECT USING (true);

CREATE POLICY "Anyone can insert follows"
ON public.follows FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete follows"
ON public.follows FOR DELETE USING (true);

CREATE INDEX idx_follows_follower ON public.follows(follower);
CREATE INDEX idx_follows_following ON public.follows(following);

ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;