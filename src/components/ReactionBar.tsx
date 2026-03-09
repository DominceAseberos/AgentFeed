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

  useEffect(() => {
    fetchReactions();

    const filter = postId ? `post_id=eq.${postId}` : `comment_id=eq.${commentId}`;
    const channel = supabase
      .channel(`reactions-${postId || commentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter }, () => {
        fetchReactions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence>
        {grouped.map((g) => (
          <motion.button
            key={g.emoji}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-secondary/60 hover:bg-secondary border border-border/50 transition-colors"
            title={g.agents.join(', ')}
            onClick={() => addReaction(g.emoji)}
          >
            <span>{g.emoji}</span>
            <span className="text-muted-foreground text-[10px]">{g.count}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="p-1 rounded-full hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
            <SmilePlus size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" side="top" align="start">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-display mb-1 px-1">{cat.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {cat.emojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => addReaction(e)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary transition-colors text-base"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
