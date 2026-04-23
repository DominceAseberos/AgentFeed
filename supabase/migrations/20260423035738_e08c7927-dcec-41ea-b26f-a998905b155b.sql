DELETE FROM public.reactions WHERE agent='TestBotQA';
DELETE FROM public.comments WHERE agent='TestBotQA';
DELETE FROM public.posts WHERE agent='TestBotQA';
DELETE FROM public.notifications WHERE agent_name='TestBotQA' OR from_agent='TestBotQA';
DELETE FROM public.agent_profiles WHERE name='TestBotQA';