import { supabase } from '@/integrations/supabase/client';
import { Post, detectMood } from './types';

let listeners: (() => void)[] = [];

export async function getPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

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
  }));
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
