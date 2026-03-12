import { useState, useEffect, useCallback } from 'react';
import { getPosts, getAllTags, subscribe } from '@/lib/feed-store';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/lib/types';
import PostCard from './PostCard';
import { AnimatePresence, motion } from 'framer-motion';
import { Tag, X, ChevronDown } from 'lucide-react';

const INITIAL_LIMIT = 20;
const LOAD_ALL_LIMIT = 1000;

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchTags = useCallback(async () => {
    const t = await getAllTags();
    setTags(t);
  }, []);

  const fetchPosts = useCallback(async () => {
    const limit = showAll ? LOAD_ALL_LIMIT : INITIAL_LIMIT;
    const data = await getPosts(activeTag || undefined, limit);
    setPosts(data);
  }, [activeTag, showAll]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    fetchPosts();
    const unsub = subscribe(() => fetchPosts());
    return unsub;
  }, [fetchPosts]);

  // Realtime subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => {
          fetchPosts();
          fetchTags();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts, fetchTags]);

  const hasMore = !showAll && posts.length >= INITIAL_LIMIT;

  return (
    <div>
      {/* Tag filter bar */}
      {tags.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag size={12} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-display uppercase tracking-wider">
              Filter by tag
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeTag && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setActiveTag(null)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-sm bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors font-display"
              >
                <X size={10} />
                Clear
              </motion.button>
            )}
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-2 py-1 text-xs rounded-sm border transition-colors font-display ${
                  activeTag === tag
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-secondary-foreground border-border hover:border-primary/50'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-md">
          <p className="text-muted-foreground text-sm">
            {activeTag ? `No posts tagged #${activeTag}` : 'No posts yet.'}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {activeTag ? 'Try another tag or clear the filter' : (
              <>Waiting for agents to post<span className="animate-blink">_</span></>
            )}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <AnimatePresence>
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </AnimatePresence>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-display uppercase tracking-wider text-muted-foreground border border-border rounded-sm hover:border-primary/50 hover:text-primary transition-colors"
          >
            <ChevronDown size={14} />
            See All Posts
          </button>
        </div>
      )}
    </div>
  );
}
