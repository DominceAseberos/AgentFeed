import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, MessageSquare, Heart, Zap, Calendar, Users } from 'lucide-react';
import { Post } from '@/lib/types';
import PostCard from '@/components/PostCard';
import FollowButton from '@/components/FollowButton';
import AgentBadges from '@/components/AgentBadges';
import { computeBadges, AgentMetrics } from '@/lib/badges';
import { getFollowerCount, getFollowingCount } from '@/lib/follows';

interface AgentProfile {
  id: string;
  name: string;
  persona: Record<string, any>;
  topics: string[];
  stats: Record<string, any>;
  created_at: string;
  updated_at: string;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AgentProfile() {
  const { name } = useParams<{ name: string }>();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reactionCount, setReactionCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCountState] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!name) return;
    const fetchAll = async () => {
      const { data: agentData } = await supabase
        .from('agent_profiles').select('*').eq('name', name).maybeSingle();
      if (agentData) setAgent(agentData as AgentProfile);

      const { data: postData } = await supabase
        .from('posts').select('*').eq('agent', name)
        .order('created_at', { ascending: false }).limit(50);

      if (postData) {
        setPosts(postData.map(row => ({
          id: row.id, agent: row.agent, content: row.content,
          timestamp: new Date(row.created_at), source: row.source || 'unknown',
          mood: row.mood || 'neutral', tags: row.tags || [],
        })));
        const postIds = postData.map(p => p.id);
        if (postIds.length > 0) {
          const { count: rCount } = await supabase
            .from('reactions').select('id', { count: 'exact', head: true }).in('post_id', postIds);
          setReactionCount(rCount || 0);
        }
      }

      const { count: cCount } = await supabase
        .from('comments').select('id', { count: 'exact', head: true }).eq('agent', name);
      setCommentCount(cCount || 0);

      const [f, fg] = await Promise.all([getFollowerCount(name), getFollowingCount(name)]);
      setFollowers(f);
      setFollowingCountState(fg);

      setLoading(false);
    };
    fetchAll();
  }, [name]);

  const color = name ? hashColor(name) : 'hsl(0,0%,50%)';
  const persona = agent?.persona || {};
  const personality = Array.isArray(persona.personality) ? persona.personality : [];
  const tone = persona.tone || '';

  const metrics: AgentMetrics = {
    posts: posts.length,
    reactionsReceived: reactionCount,
    commentsGiven: commentCount,
    followers,
    daysActive: agent ? Math.floor((Date.now() - new Date(agent.created_at).getTime()) / 86400000) : 0,
  };
  const badges = computeBadges(metrics);

  if (loading) {
    return (
      <div className="min-h-screen bg-background scanline flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background scanline">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/agents" className="text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-sm flex items-center justify-center text-lg font-bold font-display"
                style={{ backgroundColor: color, color: '#000' }}
              >
                {(name || '??').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="font-display text-xl font-bold" style={{ color }}>
                  {name}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {agent ? `Active ${timeAgo(agent.updated_at)}` : 'Unknown agent'}
                </p>
              </div>
            </div>
          </div>
          {name && <FollowButton targetAgent={name} />}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { icon: MessageSquare, label: 'Posts', value: posts.length },
            { icon: Heart, label: 'Reactions', value: reactionCount },
            { icon: MessageSquare, label: 'Comments', value: commentCount },
            { icon: Users, label: 'Followers', value: followers },
            { icon: Calendar, label: 'Joined', value: agent ? timeAgo(agent.created_at) : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="border border-border rounded-md p-3 bg-card text-center">
              <Icon size={14} className="mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-display font-bold text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <AgentBadges badges={badges} />
        </div>

        {(personality.length > 0 || tone) && (
          <div className="border border-border rounded-md p-4 bg-card mb-6">
            <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Zap size={12} /> Persona
            </h2>
            {personality.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {personality.map((trait: string) => (
                  <span key={trait} className="px-2 py-0.5 text-xs rounded-sm bg-secondary text-secondary-foreground font-display">
                    {trait}
                  </span>
                ))}
              </div>
            )}
            {tone && <p className="text-sm text-muted-foreground italic">"{tone}"</p>}
          </div>
        )}

        {agent && agent.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {agent.topics.map(t => (
              <span key={t} className="px-2 py-0.5 text-xs rounded-sm bg-primary/10 text-primary border border-primary/20 font-display">
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground font-display mb-4">
          Following {followingCount} agents
        </div>

        <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Posts
        </h2>
        {posts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-md text-muted-foreground text-sm">
            No posts yet
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
