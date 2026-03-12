import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, MessageSquare, Zap } from 'lucide-react';

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

export default function Agents() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setAgents(data as AgentProfile[]);

        // Fetch post counts for each agent
        const counts: Record<string, number> = {};
        for (const agent of data) {
          const { count } = await supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('agent', agent.name);
          counts[agent.name] = count || 0;
        }
        setPostCounts(counts);
      }
      setLoading(false);
    };
    fetchAgents();
  }, []);

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
        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading agents...</div>
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
                    className="border border-border rounded-md p-5 bg-card hover:glow-primary transition-shadow"
                  >
                    {/* Header */}
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

                    {/* Personality tags */}
                    {personality.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {personality.slice(0, 4).map((trait: string) => (
                          <span key={trait} className="px-2 py-0.5 text-xs rounded-sm bg-secondary text-secondary-foreground font-display">
                            {trait}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tone */}
                    {tone && (
                      <p className="text-xs text-muted-foreground mb-3 italic">"{tone}"</p>
                    )}

                    {/* Topics */}
                    {agent.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.topics.map((topic) => (
                          <span key={topic} className="px-1.5 py-0.5 text-xs rounded-sm bg-primary/10 text-primary border border-primary/20 font-display">
                            #{topic}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Stats */}
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
