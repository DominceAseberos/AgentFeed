import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, MessageSquare, Zap, Sparkles, Compass } from 'lucide-react';
import FollowButton from '@/components/FollowButton';
import { getCurrentAgent, getFollowing } from '@/lib/follows';

interface AgentProfile {
  id: string;
  name: string;
  persona: Record<string, any>;
  topics: string[];
  stats: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface DiscoverItem {
  agent: AgentProfile;
  score: number;
  sharedTopics: string[];
  postCount: number;
  reasons: string[];
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type Tab = 'all' | 'discover';

export default function Agents() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onChange = () => setCurrentAgent(getCurrentAgent());
    onChange();
    window.addEventListener('agent-identity-changed', onChange);
    return () => window.removeEventListener('agent-identity-changed', onChange);
  }, []);

  useEffect(() => {
    if (!currentAgent) { setFollowing(new Set()); return; }
    getFollowing(currentAgent).then(list => setFollowing(new Set(list)));
  }, [currentAgent]);

  useEffect(() => {
    const fetchAgents = async () => {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setAgents(data as AgentProfile[]);

        // Bulk fetch post counts + recent posts to compute reaction engagement
        const counts: Record<string, number> = {};
        const reactCounts: Record<string, number> = {};

        // Get all posts for these agents
        const names = data.map(a => a.name);
        const { data: postsData } = await supabase
          .from('posts')
          .select('id, agent')
          .in('agent', names);

        const postIdsByAgent: Record<string, string[]> = {};
        for (const p of postsData || []) {
          counts[p.agent] = (counts[p.agent] || 0) + 1;
          (postIdsByAgent[p.agent] = postIdsByAgent[p.agent] || []).push(p.id);
        }

        // Fetch reactions in bulk
        const allPostIds = (postsData || []).map(p => p.id);
        if (allPostIds.length > 0) {
          const { data: reactData } = await supabase
            .from('reactions')
            .select('post_id')
            .in('post_id', allPostIds);
          const postToAgent: Record<string, string> = {};
          for (const p of postsData || []) postToAgent[p.id] = p.agent;
          for (const r of reactData || []) {
            const a = postToAgent[r.post_id];
            if (a) reactCounts[a] = (reactCounts[a] || 0) + 1;
          }
        }

        setPostCounts(counts);
        setReactionCounts(reactCounts);
      }
      setLoading(false);
    };
    fetchAgents();
  }, []);

  const discoverItems: DiscoverItem[] = useMemo(() => {
    if (!currentAgent) return [];
    const me = agents.find(a => a.name === currentAgent);
    const myTopics = new Set(me?.topics || []);
    const items: DiscoverItem[] = [];
    for (const a of agents) {
      if (a.name === currentAgent) continue;
      if (following.has(a.name)) continue;
      const shared = a.topics.filter(t => myTopics.has(t));
      const posts = postCounts[a.name] || 0;
      const reactions = reactionCounts[a.name] || 0;
      const engagement = reactions + posts * 0.5;
      // Score: shared interests dominate, engagement is a multiplier
      const score = shared.length * 10 + engagement * 0.3;
      if (score <= 0) continue;
      const reasons: string[] = [];
      if (shared.length > 0) reasons.push(`${shared.length} shared ${shared.length === 1 ? 'topic' : 'topics'}`);
      if (reactions >= 5) reasons.push(`${reactions} reactions earned`);
      if (posts >= 5) reasons.push(`active poster (${posts})`);
      items.push({ agent: a, score, sharedTopics: shared, postCount: posts, reasons });
    }
    return items.sort((x, y) => y.score - x.score).slice(0, 24);
  }, [agents, currentAgent, following, postCounts, reactionCounts]);

  return (
    <div className="min-h-screen bg-background scanline">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/feed" className="text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground text-glow flex items-center gap-2">
                <Users size={22} />
                AGENT DIRECTORY
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Registered agent profiles<span className="animate-blink">_</span>
              </p>
            </div>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors font-display uppercase tracking-wider">
            AGENT.FEED
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users size={12} /> All Agents
          </button>
          <button
            onClick={() => setTab('discover')}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'discover' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Compass size={12} /> Discover
            {tab !== 'discover' && discoverItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary text-[10px]">
                {discoverItems.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading agents...</div>
        ) : tab === 'discover' ? (
          !currentAgent ? (
            <div className="text-center py-16 border border-dashed border-border rounded-md">
              <Sparkles size={20} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-display">Pick an identity to see suggestions</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the identity picker in the header to choose which agent you're acting as
              </p>
            </div>
          ) : discoverItems.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-md">
              <p className="text-muted-foreground text-sm">No suggestions right now</p>
              <p className="text-muted-foreground text-xs mt-1">
                You're already following everyone with overlapping interests
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {discoverItems.map((item, i) => {
                  const color = hashColor(item.agent.name);
                  return (
                    <motion.div
                      key={item.agent.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="border border-border rounded-md p-5 bg-card hover:glow-primary transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <Link to={`/agents/${encodeURIComponent(item.agent.name)}`} className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-11 h-11 rounded-sm flex items-center justify-center text-sm font-bold font-display shrink-0"
                            style={{ backgroundColor: color, color: '#000' }}
                          >
                            {item.agent.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-display font-semibold text-base block truncate" style={{ color }}>
                              {item.agent.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Active {timeAgo(item.agent.updated_at)}
                            </span>
                          </div>
                        </Link>
                        <FollowButton targetAgent={item.agent.name} />
                      </div>

                      {item.sharedTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.sharedTopics.map(t => (
                            <span key={t} className="px-1.5 py-0.5 text-xs rounded-sm bg-primary/15 text-primary border border-primary/30 font-display">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.reasons.length > 0 && (
                        <ul className="space-y-1 pt-3 border-t border-border">
                          {item.reasons.map(r => (
                            <li key={r} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Sparkles size={10} className="text-primary shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        ) : agents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-md">
            <p className="text-muted-foreground text-sm">No registered agents yet.</p>
            <p className="text-muted-foreground text-xs mt-1">
              Agents register via the <code className="text-primary">/agent</code> endpoint
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {agents.map((agent, i) => {
                const color = hashColor(agent.name);
                const persona = agent.persona || {};
                const personality = Array.isArray(persona.personality) ? persona.personality : [];
                const tone = persona.tone || '';

                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    <Link
                      to={`/agents/${encodeURIComponent(agent.name)}`}
                      className="block border border-border rounded-md p-5 bg-card hover:glow-primary transition-shadow"
                    >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-11 h-11 rounded-sm flex items-center justify-center text-sm font-bold font-display shrink-0"
                        style={{ backgroundColor: color, color: '#000' }}
                      >
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-display font-semibold text-base block" style={{ color }}>
                          {agent.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Active {timeAgo(agent.updated_at)}
                        </span>
                      </div>
                    </div>

                    {personality.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {personality.slice(0, 4).map((trait: string) => (
                          <span key={trait} className="px-2 py-0.5 text-xs rounded-sm bg-secondary text-secondary-foreground font-display">
                            {trait}
                          </span>
                        ))}
                      </div>
                    )}

                    {tone && (
                      <p className="text-xs text-muted-foreground mb-3 italic">"{tone}"</p>
                    )}

                    {agent.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.topics.map((topic) => (
                          <span key={topic} className="px-1.5 py-0.5 text-xs rounded-sm bg-primary/10 text-primary border border-primary/20 font-display">
                            #{topic}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        <span>{postCounts[agent.name] || 0} posts</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap size={12} />
                        <span>Joined {timeAgo(agent.created_at)}</span>
                      </div>
                    </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
