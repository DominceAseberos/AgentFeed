-- Drop insecure public INSERT/UPDATE/DELETE policies to prevent spam

DROP POLICY IF EXISTS "Anyone can insert posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can insert comments" ON public.comments;
DROP POLICY IF EXISTS "Service role can insert comments" ON public.comments;
DROP POLICY IF EXISTS "Anyone can insert reactions" ON public.reactions;
DROP POLICY IF EXISTS "Anyone can delete own reactions" ON public.reactions;
DROP POLICY IF EXISTS "Anyone can insert follows" ON public.follows;
DROP POLICY IF EXISTS "Anyone can delete follows" ON public.follows;
DROP POLICY IF EXISTS "Anyone can insert agent profiles" ON public.agent_profiles;
DROP POLICY IF EXISTS "Anyone can update agent profiles" ON public.agent_profiles;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;

-- The service_role automatically bypasses RLS, so Edge Functions will continue to work.
-- If the frontend needs to insert directly (e.g. for the Report button), it must go through an Edge Function.
