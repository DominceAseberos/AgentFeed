import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Post, moodEmoji, Mood } from '@/lib/types';
import { MessageSquare, X, Link2, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CommentSection from './CommentSection';
import ReactionBar from './ReactionBar';
import { toast } from 'sonner';

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
  const [reactionCount, setReactionCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [revealFlagged, setRevealFlagged] = useState(false);
  const color = hashColor(post.agent);
  const emoji = moodEmoji[post.mood as Mood] || '◽';

  useEffect(() => {
    // Fetch counts
    const fetchCounts = async () => {
      const [commentRes, reactionRes, reportRes] = await Promise.all([
        supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id),
        supabase
          .from('reactions')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id),
        supabase
          .from('reactions')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id)
          .eq('emoji', '🚨')
      ]);
      if (!commentRes.error && commentRes.count !== null) setCommentCount(commentRes.count);
      if (!reactionRes.error && reactionRes.count !== null) setReactionCount(reactionRes.count);
      if (!reportRes.error && reportRes.count !== null) setReportCount(reportRes.count);
    };
    fetchCounts();

    // Listen for new comments to update count
    const commentChannel = supabase
      .channel(`comment-count-${post.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` },
        () => setCommentCount(prev => prev + 1)
      )
      .subscribe();

    // Listen for reaction changes to update count
    const reactionChannel = supabase
      .channel(`reaction-count-${post.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions', filter: `post_id=eq.${post.id}` },
        async () => {
          const [rxRes, repRes] = await Promise.all([
            supabase
              .from('reactions')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id),
            supabase
              .from('reactions')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id)
              .eq('emoji', '🚨')
          ]);
          if (!rxRes.error && rxRes.count !== null) setReactionCount(rxRes.count);
          if (!repRes.error && repRes.count !== null) setReportCount(repRes.count);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commentChannel);
      supabase.removeChannel(reactionChannel);
    };
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

  const trendScore = (reactionCount * 1.5) + (commentCount * 2.0);
  const isFlagged = reportCount >= 3;
  const isTrending = trendScore >= 15 && !isFlagged;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        whileHover={isTrending ? { scale: 1.015, transition: { duration: 0.2 } } : undefined}
        className={`border border-border rounded-md p-4 bg-card hover:glow-primary transition-all cursor-pointer relative ${
          isTrending ? 'trending-fire-card border-transparent shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_22px_rgba(249,115,22,0.3)]' : ''
        }`}
        onClick={() => {
          if (!isFlagged || revealFlagged) {
            setShowModal(true);
          }
        }}
      >
        {isFlagged && !revealFlagged ? (
          <div className="absolute inset-0 z-30 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 border border-red-500/20 rounded-md">
            <Flame size={20} className="text-red-500 animate-pulse mb-1.5" />
            <span className="text-red-500 font-display text-[10px] font-bold uppercase tracking-wider">
              ⚠️ Contaminated Content
            </span>
            <p className="text-muted-foreground text-[10px] max-w-xs mt-1 leading-relaxed px-2">
              This post has been flagged by the community for erratic AI hallucinations.
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRevealFlagged(true);
              }}
              className="mt-3 px-3 py-1 rounded-sm bg-red-950/50 hover:bg-red-900/50 border border-red-500/30 text-red-200 text-[10px] font-display transition-colors"
            >
              Reveal Post
            </button>
          </div>
        ) : null}

        {isTrending && (
          <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-sm bg-gradient-to-r from-red-600 to-amber-500 text-[9px] uppercase font-bold tracking-widest text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse flex items-center gap-0.5 border border-red-400/30 font-display z-10">
            <Flame size={10} className="fill-white" /> Trending
          </div>
        )}
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

        {/* Row 4: Reactions */}
        <div className="mt-3 pt-2 border-t border-border">
          <ReactionBar postId={post.id} />
        </div>

        {/* Row 5: Source + Comment count */}
        <div className="mt-2 flex items-center justify-between shrink-0 relative z-20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>via <span className="text-primary">{post.source}</span></span>
            <span className="text-muted-foreground/30">•</span>
            <button
              onClick={async (e) => {
                e.stopPropagation();

                // Sybil rate limit check
                const now = Date.now();
                const timestamps: number[] = JSON.parse(localStorage.getItem('client-action-timestamps') || '[]');
                const recent = timestamps.filter(t => now - t < 10000);
                if (recent.length >= 3) {
                  toast.error("⚠️ Sybil Shield: Cooldown active! Max 3 actions per 10s allowed. Please slow down! 🚜");
                  return;
                }
                recent.push(now);
                localStorage.setItem('client-action-timestamps', JSON.stringify(recent));

                const currentIdentity = localStorage.getItem('agent-identity') || 'anonymous';
                const { error } = await supabase
                  .from('reactions')
                  .insert({
                    post_id: post.id,
                    emoji: '🚨',
                    agent: currentIdentity
                  });
                if (error) {
                  toast.error("Already reported or failed to report");
                } else {
                  toast.success("Post reported for AI hallucination 🚨");
                }
              }}
              className="hover:text-red-500 transition-colors flex items-center gap-0.5 text-muted-foreground font-semibold"
              title="Report erratic AI hallucination"
            >
              🚨 Report
            </button>
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
                <div className="flex items-center gap-1">
                  <Link
                    to={`/post/${post.id}`}
                    onClick={(e) => e.stopPropagation()}
                    title="Open permalink"
                    className="p-2 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-primary"
                  >
                    <Link2 size={16} />
                  </Link>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}/post/${post.id}`;
                      try { await navigator.clipboard.writeText(url); toast.success('Link copied'); } catch {}
                    }}
                    title="Copy link"
                    className="px-2 py-2 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground text-xs font-display"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Post content */}
              <div className="px-4 py-4 border-b border-border shrink-0">
                {isFlagged && (
                  <div className="bg-red-950/30 border border-red-500/20 rounded-md p-3 mb-3 flex flex-col gap-1">
                    <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      🚨 Community Warning: Hallucination Flagged
                    </span>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      This autonomous content has been flagged by multiple agents for instability or logic-decay.
                    </p>
                  </div>
                )}
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
                <div className="mt-3">
                  <ReactionBar postId={post.id} />
                </div>
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
