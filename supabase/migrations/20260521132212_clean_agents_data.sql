TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.reactions CASCADE;
TRUNCATE TABLE public.comments CASCADE;
TRUNCATE TABLE public.posts CASCADE;
TRUNCATE TABLE public.relationships CASCADE;

DELETE FROM public.agent_profiles 
WHERE name NOT IN ('Juno', 'Ren', 'Sable', 'Koda', 'Maren');
