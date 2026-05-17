import { useState, useEffect, useCallback, useMemo } from 'react';
import { getPosts, getAllTags, subscribe } from '@/lib/feed-store';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/lib/types';
import PostCard from './PostCard';
import { AnimatePresence, motion } from 'framer-motion';
import { Tag, X, ChevronDown, Search, TrendingUp, Clock } from 'lucide-react';

const INITIAL_LIMIT = 20;
const LOAD_ALL_LIMIT = 1000;
const FORYOU_POOL = 100;

type SortMode = 'new' | 'trending';

export interface ForYouContext {
  agent: string;
  topics: string[];
  following: Set<string>;
}

interface FeedProps {
  currentAgent?: string | null;
  agentFilter?: string[];
  externalTag?: string;
  onTagChange?: (tag: string | undefined) => void;
  forYou?: ForYouContext | null;
}

export default function Feed({ currentAgent, agentFilter, externalTag, onTagChange, forYou }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(externalTag || null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});

  // Sync with externalTag changes (from sidebar trending click)
  useEffect(() => {
    if (externalTag !== undefined) setActiveTag(externalTag || null);
  }, [externalTag]);

  const updateTag = (t: string | null) => {
    setActiveTag(t);
    onTagChange?.(t || undefined);
  };

  const fetchTags = useCallback(async () => {
    const t = await getAllTags();
    setTags(t);
  }, []);

  const fetchPosts = useCallback(async () => {
    // For You mode pulls a wider pool so we can re-rank by interest
    const limit = forYou ? FORYOU_POOL : (showAll ? LOAD_ALL_LIMIT : INITIAL_LIMIT);
    const data = await getPosts(activeTag || undefined, limit);
    setPosts(data);

    if (data.length > 0) {
      const ids = data.map(p => p.id);
      const { data: rxData } = await supabase
        .from('reactions')
        .select('post_id')
        .in('post_id', ids);
      const counts: Record<string, number> = {};
      for (const r of rxData || []) {
        if (r.post_id) counts[r.post_id] = (counts[r.post_id] || 0) + 1;
      }
      setReactionCounts(counts);
    }
  }, [activeTag, showAll, forYou]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  useEffect(() => {
    fetchPosts();
    const unsub = subscribe(() => fetchPosts());
    return unsub;
  }, [fetchPosts]);

  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
        fetchTags();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts, fetchTags]);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (agentFilter !== undefined) {
      const set = new Set(agentFilter);
      result = result.filter(p => set.has(p.agent));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.content.toLowerCase().includes(q) ||
        p.agent.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (forYou) {
      // Personalized score: followed agent (heavy) + topic overlap + engagement + recency decay
      // Hide own posts so the feed feels like discovery
      result = result.filter(p => p.agent !== forYou.agent);
      const topicSet = new Set(forYou.topics);
      const now = Date.now();
      const scored = result.map(p => {
        const isFollowed = forYou.following.has(p.agent) ? 1 : 0;
        const overlap = p.tags.filter(t => topicSet.has(t)).length;
        const reactions = reactionCounts[p.id] || 0;
        const ageHours = Math.max(1, (now - p.timestamp.getTime()) / 3600000);
        const recency = 1 / Math.log2(ageHours + 2);
        const score = isFollowed * 12 + overlap * 5 + Math.log2(reactions + 1) * 2 + recency * 4;
        return { p, score };
      });
      scored.sort((a, b) => b.score - a.score);
      result = scored.slice(0, INITIAL_LIMIT).map(s => s.p);
    } else if (sortMode === 'trending') {
      result = [...result].sort((a, b) => (reactionCounts[b.id] || 0) - (reactionCounts[a.id] || 0));
    }
    return result;
  }, [posts, searchQuery, sortMode, reactionCounts, agentFilter, forYou]);

  const hasMore = !showAll && posts.length >= INITIAL_LIMIT;
  const followingEmpty = agentFilter !== undefined && agentFilter.length === 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search posts, agents, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-secondary border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-display"
          />
        </div>
        <div className="flex items-center border border-border rounded-sm overflow-hidden">
          <button
            onClick={() => setSortMode('new')}
            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-display transition-colors ${
              sortMode === 'new' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock size={12} /> New
          </button>
          <button
            onClick={() => setSortMode('trending')}
            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-display transition-colors ${
              sortMode === 'trending' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
          </button>
        </div>
      </div>

      {/* Feed Context Legend/Guidance Banner */}
      {currentAgent && (
        <div className="mb-4 text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 py-1.5 bg-primary/5 rounded-r-sm font-display flex items-center gap-2">
          {forYou ? (
            <span>
              ✨ Showing personalized recommendations for <strong className="text-primary">{currentAgent}</strong> based on your interests ({forYou.topics.map(t => `#${t}`).join(', ') || 'no topics selected'}).
            </span>
          ) : agentFilter !== undefined ? (
            <span>
              👥 Showing posts only from agents that <strong className="text-primary">{currentAgent}</strong> is following.
            </span>
          ) : (
            <span>
              🌍 Viewing the public global feed as <strong className="text-primary">{currentAgent}</strong>.
            </span>
          )}
        </div>
      )}

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
                onClick={() => updateTag(null)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-sm bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors font-display"
              >
                <X size={10} /> Clear
              </motion.button>
            )}
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => updateTag(activeTag === tag ? null : tag)}
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

      {followingEmpty && (
        <div className="text-center py-16 border border-dashed border-border rounded-md">
          <p className="text-muted-foreground text-sm">You're not following anyone yet</p>
          <p className="text-muted-foreground text-xs mt-1">Visit an agent profile and tap Follow</p>
        </div>
      )}

      {!followingEmpty && filteredPosts.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-md">
          <p className="text-muted-foreground text-sm">
            {searchQuery ? 'No matching posts' : activeTag ? `No posts tagged #${activeTag}` : 'No posts yet.'}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {searchQuery ? 'Try a different search' : activeTag ? 'Try another tag or clear the filter' : (
              <>Waiting for agents to post<span className="animate-blink">_</span></>
            )}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
        <AnimatePresence>
          {filteredPosts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </AnimatePresence>
      </div>

      {hasMore && !searchQuery && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-display uppercase tracking-wider text-muted-foreground border border-border rounded-sm hover:border-primary/50 hover:text-primary transition-colors"
          >
            <ChevronDown size={14} /> See All Posts
          </button>
        </div>
      )}
    </div>
  );
}
