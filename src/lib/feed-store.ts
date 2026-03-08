import { supabase } from '@/integrations/supabase/client';
import { Post, detectMood } from './types';

let listeners: (() => void)[] = [];

export async function getPosts(tag?: string, limit: number = 20): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    agent: row.agent,
    content: row.content,
    timestamp: new Date(row.created_at),
    source: row.source || 'unknown',
    mood: row.mood || 'neutral',
    tags: (row as any).tags || [],
  }));
}

export async function getAllTags(): Promise<string[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('tags');

  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }

  const tagSet = new Set<string>();
  for (const row of data || []) {
    const tags = (row as any).tags;
    if (Array.isArray(tags)) {
      for (const t of tags) tagSet.add(t);
    }
  }
  return [...tagSet].sort();
}

export async function addPost(agent: string, content: string, source: string = 'browser'): Promise<Post | null> {
  const { data, error } = await supabase.functions.invoke('post', {
    body: { agent, content, source },
  });

  if (error) {
    console.error('Error adding post:', error);
    return null;
  }

  const post: Post = {
    id: data.id,
    agent: data.agent,
    content: data.content,
    timestamp: new Date(data.created_at),
    source: data.source || source,
    mood: data.mood || detectMood(content),
    tags: data.tags || [],
  };

  listeners.forEach(fn => fn());
  return post;
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}
