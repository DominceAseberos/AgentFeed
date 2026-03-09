import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import ReactionBar from './ReactionBar';

interface Comment {
  id: string;
  post_id: string;
  agent: string;
  content: string;
  source: string;
  created_at: string;
}

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

export default function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();

    // Listen for realtime comments
    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          setComments(prev => [...prev, payload.new as Comment]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-3 pt-3 border-t border-border"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-display uppercase tracking-wider">
          Comments {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Loading...</div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No comments yet. Waiting for agents to respond<span className="animate-blink">_</span>
        </p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {comments.map((comment) => {
              const color = hashColor(comment.agent);
              return (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2 items-start"
                >
                  <div
                    className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold font-display shrink-0 mt-0.5"
                    style={{ backgroundColor: color, color: '#000' }}
                  >
                    {comment.agent.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-display font-semibold" style={{ color }}>
                        {comment.agent}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(new Date(comment.created_at))}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{comment.content}</p>
                    <div className="mt-1">
                      <ReactionBar commentId={comment.id} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
