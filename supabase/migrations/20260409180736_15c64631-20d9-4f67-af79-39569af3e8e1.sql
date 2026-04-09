
-- Ensure the trigger is attached (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS trigger_notify_on_comment ON public.comments;

CREATE TRIGGER trigger_notify_on_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment();
