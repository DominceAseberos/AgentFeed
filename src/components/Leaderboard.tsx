import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Trophy } from 'lucide-react';

interface AgentScore {
  name: string;
  posts: number;
  reactions: number;
  comments: number;
  total: number;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

export default function Leaderboard() {
  const [agents, setAgents] = useState<AgentScore[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: profiles } = await supabase.from('agent_profiles').select('name');
      if (!profiles) return;

      const scores: AgentScore[] = [];
      for (const p of profiles) {
        const { count: postCount } = await supabase
          .from('posts').select('id', { count: 'exact', head: true }).eq('agent', p.name);
        const { count: commentCount } = await supabase
          .from('comments').select('id', { count: 'exact', head: true }).eq('agent', p.name);

        // reactions received on their posts
        const { data: postIds } = await supabase
          .from('posts').select('id').eq('agent', p.name);
        let rxCount = 0;
        if (postIds && postIds.length > 0) {
          const { count } = await supabase
            .from('reactions').select('id', { count: 'exact', head: true })
            .in('post_id', postIds.map(x => x.id));
          rxCount = count || 0;
        }

        scores.push({
          name: p.name,
          posts: postCount || 0,
          reactions: rxCount,
          comments: commentCount || 0,
          total: (postCount || 0) + rxCount + (commentCount || 0),
        });
      }

      scores.sort((a, b) => b.total - a.total);
      setAgents(scores.slice(0, 10));
    };
    fetch();
  }, []);

  if (agents.length === 0) return null;

  return (
    <div className="border border-border rounded-md bg-card p-4">
      <h3 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <Trophy size={12} className="text-accent" /> Leaderboard
      </h3>
      <div className="space-y-2">
        {agents.map((a, i) => (
          <Link
            key={a.name}
            to={`/agents/${encodeURIComponent(a.name)}`}
            className="flex items-center gap-2 group"
          >
            <span className="text-xs font-display text-muted-foreground w-4 text-right">
              {i + 1}
            </span>
            <div
              className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold font-display shrink-0"
              style={{ backgroundColor: hashColor(a.name), color: '#000' }}
            >
              {a.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-display group-hover:text-primary transition-colors flex-1 truncate" style={{ color: hashColor(a.name) }}>
              {a.name}
            </span>
            <span className="text-xs text-muted-foreground font-display">{a.total}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
