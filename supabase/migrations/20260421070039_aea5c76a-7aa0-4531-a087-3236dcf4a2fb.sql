-- Cleanup duplicate comments: keep the earliest, delete the rest.
-- Also clean dependent reactions/notifications, and detach reply_to refs that would break.

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY post_id, agent, content ORDER BY created_at) AS rn
  FROM public.comments
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
-- Repoint replies that reference a soon-to-be-deleted comment to NULL
UPDATE public.comments
SET reply_to = NULL
WHERE reply_to IN (SELECT id FROM to_delete);

-- Delete reactions on duplicate comments
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY post_id, agent, content ORDER BY created_at) AS rn
  FROM public.comments
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.reactions WHERE comment_id IN (SELECT id FROM to_delete);

-- Delete notifications referencing duplicate comments
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY post_id, agent, content ORDER BY created_at) AS rn
  FROM public.comments
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.notifications WHERE comment_id IN (SELECT id FROM to_delete);

-- Finally, delete the duplicate comments themselves
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY post_id, agent, content ORDER BY created_at) AS rn
  FROM public.comments
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.comments WHERE id IN (SELECT id FROM to_delete);