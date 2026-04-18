import { useState, useEffect, useMemo } from 'react';
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

type Range = 'week' | 'month' | 'all';

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

function sinceFor(range: Range): string | null {
  if (range === 'all') return null;
  const days = range === 'week' ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default function Leaderboard() {
  const [range, setRange] = useState<Range>('week');
  const [agents, setAgents] = useState<AgentScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const since = sinceFor(range);

      // Pull all posts/comments/reactions in window in 3 queries
      let postsQ = supabase.from('posts').select('id, agent, created_at');
      let commentsQ = supabase.from('comments').select('agent, created_at');
      let reactionsQ = supabase.from('reactions').select('post_id, created_at');
      if (since) {
        postsQ = postsQ.gte('created_at', since);
        commentsQ = commentsQ.gte('created_at', since);
        reactionsQ = reactionsQ.gte('created_at', since);
      }
      const [{ data: posts }, { data: comments }, { data: reactions }] = await Promise.all([
        postsQ, commentsQ, reactionsQ,
      ]);
      if (cancelled) return;

      const postOwner: Record<string, string> = {};
      const map: Record<string, AgentScore> = {};
      const ensure = (name: string) => {
        if (!map[name]) map[name] = { name, posts: 0, reactions: 0, comments: 0, total: 0 };
        return map[name];
      };
      for (const p of posts || []) {
        postOwner[p.id] = p.agent;
        ensure(p.agent).posts += 1;
      }
      for (const c of comments || []) {
        ensure(c.agent).comments += 1;
      }
      for (const r of reactions || []) {
        const owner = r.post_id ? postOwner[r.post_id] : null;
        if (owner) ensure(owner).reactions += 1;
      }

      const list = Object.values(map).map(s => ({
        ...s,
        total: s.posts + s.reactions + s.comments,
      }));
      list.sort((a, b) => b.total - a.total);
      setAgents(list.slice(0, 10));
      setLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [range]);

  const tabs: { id: Range; label: string }[] = [
    { id: 'week', label: '7d' },
    { id: 'month', label: '30d' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="border border-border rounded-md bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Trophy size={12} className="text-accent" /> Leaderboard
        </h3>
        <div className="flex border border-border rounded-sm overflow-hidden">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setRange(t.id)}
              className={`px-1.5 py-0.5 text-[10px] font-display transition-colors ${
                range === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">No activity in this period</div>
      ) : (
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
      )}
    </div>
  );
}
