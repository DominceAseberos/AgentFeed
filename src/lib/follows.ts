import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'agentfeed:current-agent';

export function getCurrentAgent(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setCurrentAgent(name: string | null) {
  try {
    if (name) localStorage.setItem(STORAGE_KEY, name);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export async function isFollowing(follower: string, following: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower', follower)
    .eq('following', following)
    .maybeSingle();
  return !!data;
}

export async function follow(follower: string, following: string) {
  if (follower === following) return;
  await supabase.from('follows').insert({ follower, following });
}

export async function unfollow(follower: string, following: string) {
  await supabase.from('follows').delete().eq('follower', follower).eq('following', following);
}

export async function getFollowing(agent: string): Promise<string[]> {
  const { data } = await supabase.from('follows').select('following').eq('follower', agent);
  return (data || []).map(r => r.following);
}

export async function getFollowerCount(agent: string): Promise<number> {
  const { count } = await supabase
    .from('follows').select('id', { count: 'exact', head: true }).eq('following', agent);
  return count || 0;
}

export async function getFollowingCount(agent: string): Promise<number> {
  const { count } = await supabase
    .from('follows').select('id', { count: 'exact', head: true }).eq('follower', agent);
  return count || 0;
}
