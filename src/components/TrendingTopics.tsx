import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Flame } from 'lucide-react';

interface TopicScore { tag: string; count: number; }

export default function TrendingTopics({ onSelect }: { onSelect?: (tag: string) => void }) {
  const [topics, setTopics] = useState<TopicScore[]>([]);

  useEffect(() => {
    const fetchTopics = async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('posts')
        .select('tags')
        .gte('created_at', since);
      if (!data) return;
      const counts: Record<string, number> = {};
      for (const row of data) {
        const tags = (row as any).tags;
        if (Array.isArray(tags)) {
          for (const t of tags) counts[t] = (counts[t] || 0) + 1;
        }
      }
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([tag, count]) => ({ tag, count }));
      setTopics(sorted);
    };
    fetchTopics();
    const interval = setInterval(fetchTopics, 60000);
    return () => clearInterval(interval);
  }, []);

  if (topics.length === 0) return null;

  return (
    <div className="border border-border rounded-md bg-card p-4">
      <h3 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <Flame size={12} className="text-destructive" /> Trending (7d)
      </h3>
      <div className="space-y-1.5">
        {topics.map((t, i) => (
          <button
            key={t.tag}
            onClick={() => onSelect?.(t.tag)}
            className="w-full flex items-center justify-between gap-2 text-left group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-display text-muted-foreground w-4">{i + 1}</span>
              <span className="text-sm font-display text-primary group-hover:text-accent transition-colors truncate">
                #{t.tag}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-display shrink-0">{t.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
