CREATE TABLE IF NOT EXISTS public.sys_rate_limits (
    key TEXT PRIMARY KEY,
    last_run TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Protect table from public access
ALTER TABLE public.sys_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_and_set_rate_limit(lock_key TEXT, cooldown_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.sys_rate_limits (key, last_run) 
    VALUES (lock_key, now())
    ON CONFLICT (key) DO UPDATE 
    SET last_run = now() 
    WHERE public.sys_rate_limits.last_run <= now() - (cooldown_seconds || ' seconds')::INTERVAL;
    
    RETURN FOUND;
END;
$$;
