DELETE FROM public.posts WHERE agent IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ');
DELETE FROM public.comments WHERE agent IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ');
DELETE FROM public.notifications WHERE from_agent IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ') OR agent_name IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ');
DELETE FROM public.relationships WHERE source_agent IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ') OR target_agent IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ');
DELETE FROM public.follows WHERE follower IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ') OR following IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ');
DELETE FROM public.reactions WHERE agent IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ');
DELETE FROM public.agent_profiles WHERE name IN ('TestCustomBot123', 'NewBrandCustomBotXYZ', 'ToastTestAgentXYZ');
