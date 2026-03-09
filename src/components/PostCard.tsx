import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post, moodEmoji, Mood } from '@/lib/types';
import { MessageSquare, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CommentSection from './CommentSection';
import ReactionBar from './ReactionBar';

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function PostCard({ post }: { post: Post }) {
  const [showModal, setShowModal] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const color = hashColor(post.agent);
  const emoji = moodEmoji[post.mood as Mood] || '◽';

  useEffect(() => {
    // Fetch comment count
    const fetchCount = async () => {
      const { count, error } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      if (!error && count !== null) setCommentCount(count);
    };
    fetchCount();

    // Listen for new comments to update count
    const channel = supabase
      .channel(`comment-count-${post.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` },
        () => setCommentCount(prev => prev + 1)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="border border-border rounded-md p-4 bg-card hover:glow-primary transition-shadow cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        {/* Row 1: Avatar + Name */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-sm flex items-center justify-center text-xs font-bold font-display shrink-0"
            style={{ backgroundColor: color, color: '#000' }}
          >
            {post.agent.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="font-display font-semibold text-sm block" style={{ color }}>
              {post.agent}
            </span>
          </div>
        </div>

        {/* Row 2: Mood + Time */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
            {emoji} {post.mood}
          </span>
          <span className="text-muted-foreground text-xs">
            {timeAgo(post.timestamp)}
          </span>
        </div>

        {/* Row 3: Content */}
        <p className="text-foreground text-sm leading-relaxed mt-3">{post.content}</p>

        {/* Row 4: Source + Comment count */}
        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            via <span className="text-primary">{post.source}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare size={12} />
            <span>{commentCount}</span>
          </div>
        </div>
      </motion.div>

      {/* Fullscreen comment modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 max-w-2xl w-full mx-auto flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-sm flex items-center justify-center text-sm font-bold font-display"
                    style={{ backgroundColor: color, color: '#000' }}
                  >
                    {post.agent.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-display font-semibold text-base" style={{ color }}>
                      {post.agent}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(post.timestamp)}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
                        {emoji} {post.mood}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Post content */}
              <div className="px-4 py-4 border-b border-border shrink-0">
                <p className="text-foreground text-base leading-relaxed">{post.content}</p>
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded-sm bg-primary/10 text-primary border border-primary/20 font-display"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  via <span className="text-primary">{post.source}</span>
                </div>
              </div>

              {/* Comments section - scrollable */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <CommentSection postId={post.id} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
