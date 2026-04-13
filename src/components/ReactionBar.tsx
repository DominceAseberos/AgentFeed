import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const EMOJI_CATEGORIES = [
  { label: 'Smileys', emojis: ['😂', '🤣', '😭', '🥹', '😍', '🤯', '🫡', '🤔', '😤', '🥴', '😈', '💀', '🤖', '👻'] },
  { label: 'Gestures', emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🫶', '💪', '🖖', '👀'] },
  { label: 'Symbols', emojis: ['🔥', '💯', '⚡', '✨', '💡', '🎯', '🚀', '💎', '🏆', '❤️', '💔', '🧠', '🫠', '🪄'] },
  { label: 'Objects', emojis: ['☕', '🍕', '🎮', '🎵', '📦', '🗑️', '🪲', '🐛', '🦀', '🐍'] },
];

interface Reaction {
  id: string;
  emoji: string;
  agent: string;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  agents: string[];
}

export default function ReactionBar({
  postId,
  commentId,
}: {
  postId?: string;
  commentId?: string;
}) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);

  const fetchReactions = async () => {
    let query = supabase.from('reactions').select('id, emoji, agent');
    if (postId) query = query.eq('post_id', postId);
    if (commentId) query = query.eq('comment_id', commentId);

    const { data } = await query;
    if (data) setReactions(data);
  };

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    fetchReactions();

    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const filter = postId ? `post_id=eq.${postId}` : `comment_id=eq.${commentId}`;
    const channelName = `reactions-${postId || commentId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter }, () => {
        fetchReactions();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [postId, commentId]);

  const grouped: ReactionGroup[] = [];
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions) {
    if (!map.has(r.emoji)) {
      const g = { emoji: r.emoji, count: 0, agents: [] as string[] };
      map.set(r.emoji, g);
      grouped.push(g);
    }
    const g = map.get(r.emoji)!;
    g.count++;
    g.agents.push(r.agent);
  }

  const addReaction = async (emoji: string) => {
    setOpen(false);
    const payload: any = { emoji, agent: 'anon-browser' };
    if (postId) payload.post_id = postId;
    if (commentId) payload.comment_id = commentId;

    await supabase.from('reactions').insert(payload);
  };

  if (grouped.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {grouped.map((g) => (
        <span
          key={g.emoji}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-secondary/60 border border-border/50"
          title={g.agents.join(', ')}
        >
          <span>{g.emoji}</span>
          <span className="text-muted-foreground text-[10px]">{g.count}</span>
        </span>
      ))}
    </div>
  );
}
