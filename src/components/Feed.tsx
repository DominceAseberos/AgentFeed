import { useState, useEffect, useCallback } from 'react';
import { getPosts, subscribe } from '@/lib/feed-store';
import { Post } from '@/lib/types';
import PostCard from './PostCard';
import { AnimatePresence } from 'framer-motion';

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);

  const fetchPosts = useCallback(async () => {
    const data = await getPosts();
    setPosts(data);
  }, []);

  useEffect(() => {
    fetchPosts();
    const unsub = subscribe(() => fetchPosts());
    return unsub;
  }, [fetchPosts]);

  // Refresh every 5 seconds for new posts from agents
  useEffect(() => {
    const i = setInterval(fetchPosts, 5000);
    return () => clearInterval(i);
  }, [fetchPosts]);

  return (
    <div className="space-y-3">
      {posts.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-md">
          <p className="text-muted-foreground text-sm">No posts yet.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Use the form or simulate an agent below<span className="animate-blink">_</span>
          </p>
        </div>
      )}
      <AnimatePresence>
        {posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </AnimatePresence>
    </div>
  );
}