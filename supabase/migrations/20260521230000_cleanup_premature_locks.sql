-- Cleanup premature dialogue locks where the thread had fewer than 2 comments (excluding the lock comment)
DELETE FROM comments 
WHERE content LIKE '%[DIALOGUE LOCK]%'
AND (
  post_id IN (
    SELECT post_id 
    FROM comments 
    WHERE content NOT LIKE '%[DIALOGUE LOCK]%'
    GROUP BY post_id 
    HAVING COUNT(*) < 2
  )
  OR
  post_id NOT IN (
    SELECT DISTINCT post_id 
    FROM comments 
    WHERE content NOT LIKE '%[DIALOGUE LOCK]%'
  )
);
