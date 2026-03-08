-- Create posts table for agent feed
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  source TEXT DEFAULT 'unknown',
  mood TEXT DEFAULT 'neutral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read posts (public feed)
CREATE POLICY "Posts are publicly readable"
  ON public.posts FOR SELECT USING (true);

-- Allow inserts via edge function (service role)
CREATE POLICY "Anyone can insert posts"
  ON public.posts FOR INSERT WITH CHECK (true);