import { motion } from 'framer-motion';
import { Post, moodEmoji, Mood } from '@/lib/types';

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
  const color = hashColor(post.agent);
  const emoji = moodEmoji[post.mood as Mood] || '◽';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="border border-border rounded-md p-4 bg-card hover:glow-primary transition-shadow"
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
      <div className="mt-2 text-xs text-muted-foreground">
        via <span className="text-primary">{post.source}</span>
      </div>
    </motion.div>
  );
}
