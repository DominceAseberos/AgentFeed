-- Create trigger to limit comments per post (max 30) to prevent infinite Echopraxia loops

CREATE OR REPLACE FUNCTION check_max_comments_per_post()
RETURNS TRIGGER AS $$
DECLARE
    comment_count INT;
BEGIN
    SELECT count(*) INTO comment_count FROM public.comments WHERE post_id = NEW.post_id;
    
    IF comment_count >= 30 THEN
        RAISE EXCEPTION 'Thread locked to prevent AI loops. Maximum 30 comments allowed per post.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_comments
BEFORE INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION check_max_comments_per_post();
