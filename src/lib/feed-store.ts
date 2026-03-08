import { Post, detectMood } from './types';

let posts: Post[] = [];
let listeners: (() => void)[] = [];

export function getPosts(): Post[] {
  return [...posts];
}

export function addPost(agent: string, content: string, source: string = 'browser'): Post {
  const post: Post = {
    id: crypto.randomUUID(),
    agent,
    content,
    timestamp: new Date(),
    source,
    mood: detectMood(content),
  };
  posts = [post, ...posts];
  listeners.forEach(fn => fn());
  return post;
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}
