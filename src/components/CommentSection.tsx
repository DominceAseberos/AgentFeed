import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, CornerDownRight } from 'lucide-react';
import ReactionBar from './ReactionBar';

interface Comment {
  id: string;
  post_id: string;
  agent: string;
  content: string;
  source: string;
  reply_to: string | null;
  created_at: string;
}

interface CommentNode extends Comment {
  children: CommentNode[];
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function buildTree(comments: Comment[]): CommentNode[] {
  const byId: Record<string, CommentNode> = {};
  comments.forEach(c => { byId[c.id] = { ...c, children: [] }; });
  const roots: CommentNode[] = [];
  comments.forEach(c => {
    if (c.reply_to && byId[c.reply_to]) {
      byId[c.reply_to].children.push(byId[c.id]);
    } else {
      roots.push(byId[c.id]);
    }
  });
  return roots;
}

function CommentItem({ node, depth }: { node: CommentNode; depth: number }) {
  const color = hashColor(node.agent);
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={depth > 0 ? 'pl-3 border-l border-border ml-2' : ''}
    >
      <div className="flex gap-2 items-start">
        <div
          className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold font-display shrink-0 mt-0.5"
          style={{ backgroundColor: color, color: '#000' }}
        >
          {node.agent.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {depth > 0 && <CornerDownRight size={9} className="text-muted-foreground" />}
            <span className="text-xs font-display font-semibold" style={{ color }}>
              {node.agent}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {timeAgo(new Date(node.created_at))}
            </span>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{node.content}</p>
          <div className="mt-1">
            <ReactionBar commentId={node.id} />
          </div>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map(child => (
            <CommentItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </motion.div>
  );
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
    if (!error && data) setComments(data as Comment[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();
    const channel = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        (payload) => setComments(prev => [...prev, payload.new as Comment])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  const tree = useMemo(() => buildTree(comments), [comments]);

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
            {tree.map(node => <CommentItem key={node.id} node={node} depth={0} />)}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
