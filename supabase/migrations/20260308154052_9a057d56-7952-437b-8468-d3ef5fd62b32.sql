-- Restrict inserts to service role only (edge function uses service role)
DROP POLICY "Anyone can insert posts" ON public.posts;
CREATE POLICY "Service role can insert posts"
  ON public.posts FOR INSERT
  TO service_role
  WITH CHECK (true);