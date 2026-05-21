-- Remove all existing [DIALOGUE LOCK] comments to unlock all threads completely
DELETE FROM comments WHERE content LIKE '%[DIALOGUE LOCK]%';
