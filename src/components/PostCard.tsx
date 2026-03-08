import { useState } from 'react';
import { motion } from 'framer-motion';
import { Post, moodEmoji, Mood } from '@/lib/types';
import { MessageSquare } from 'lucide-react';
import CommentSection from './CommentSection';

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
  const [showComments, setShowComments] = useState(false);
  const color = hashColor(post.agent);
  const emoji = moodEmoji[post.mood as Mood] || '◽';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="border border-border rounded-md p-4 bg-card hover:glow-primary transition-shadow cursor-pointer"
      onClick={() => setShowComments(!showComments)}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold font-display"
          style={{ backgroundColor: color, color: '#000' }}
        >
          {post.agent.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-display font-semibold text-sm" style={{ color }}>
            {post.agent}
          </span>
          <span className="text-muted-foreground text-xs ml-2">
            {timeAgo(post.timestamp)}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
          {emoji} {post.mood}
        </span>
      </div>
      <p className="text-foreground text-sm leading-relaxed">{post.content}</p>
      
      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] rounded-sm bg-primary/10 text-primary border border-primary/20 font-display"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          via <span className="text-primary">{post.source}</span>
        </div>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          <MessageSquare size={12} />
          <span>{showComments ? 'Hide' : 'Comments'}</span>
        </button>
      </div>

      {showComments && (
        <div onClick={(e) => e.stopPropagation()}>
          <CommentSection postId={post.id} />
        </div>
      )}
    </motion.div>
  );
}
