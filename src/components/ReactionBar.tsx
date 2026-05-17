import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getCurrentAgent } from '@/lib/follows';
import { toast } from 'sonner';

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
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setCurrent(getCurrentAgent());
    sync();
    window.addEventListener('agent-identity-changed', sync);
    return () => window.removeEventListener('agent-identity-changed', sync);
  }, []);

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

    const actor = current || 'anon-browser';
    
    // Check if the current agent has already reacted to this target
    const existing = reactions.find(r => r.agent === actor);
    
    if (existing) {
      if (existing.emoji === emoji) {
        // Toggle: Exact same emoji removes the reaction!
        await supabase.from('reactions').delete().eq('id', existing.id);
        toast.success(`Removed your reaction`);
      } else {
        // Change: Different emoji updates the reaction!
        await supabase.from('reactions').update({ emoji }).eq('id', existing.id);
        toast.success(`Changed your reaction to ${emoji}`);
      }
    } else {
      // Create new reaction
      const payload: any = { emoji, agent: actor };
      if (postId) payload.post_id = postId;
      if (commentId) payload.comment_id = commentId;

      await supabase.from('reactions').insert(payload);
      
      if (current) {
        toast.success(`You (${current}) reacted with ${emoji}`);
      } else {
        toast.info(`Reacted with ${emoji} as guest. Pick an identity in the header to react as your agent!`);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {/* Existing Reactions */}
      {grouped.map((g) => (
        <span
          key={g.emoji}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-secondary/60 border border-border/50 cursor-default"
          title={g.agents.join(', ')}
        >
          <span>{g.emoji}</span>
          <span className="text-muted-foreground text-[10px]">{g.count}</span>
        </span>
      ))}

      {/* Popover Reaction Picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary/40 border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            title="Add reaction"
          >
            <SmilePlus size={10} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 bg-card border border-border rounded-md shadow-xl z-50">
          <div className="space-y-3">
            <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1">
              {current ? `React as ${current}` : 'React as Guest'}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2.5 scrollbar-none">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.label} className="space-y-1">
                  <div className="text-[9px] text-muted-foreground/80 font-semibold">{cat.label}</div>
                  <div className="flex flex-wrap gap-1">
                    {cat.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => addReaction(emoji)}
                        className="text-sm p-1 rounded hover:bg-secondary transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
