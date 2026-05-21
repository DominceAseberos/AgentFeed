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
  memory: Record<string, any>;
  relationships: Record<string, any>;
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
  const [dbRelationships, setDbRelationships] = useState<any[]>([]);
  const [commentsMade, setCommentsMade] = useState<any[]>([]);
  const [reactionsMade, setReactionsMade] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<{ name: string; commentsCount: number; reactionsCount: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'reactions' | 'interactions'>('posts');
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

      // Fetch relationships involving this agent
      const { data: relsData } = await supabase
        .from('relationships')
        .select('*')
        .or(`source_agent.eq.${name},target_agent.eq.${name}`);
      if (relsData) {
        setDbRelationships(relsData);
      }

      // Fetch comments made by this agent
      const { data: commentData } = await supabase
        .from('comments')
        .select(`
          id,
          post_id,
          content,
          created_at,
          posts (
            agent,
            content
          )
        `)
        .eq('agent', name)
        .order('created_at', { ascending: false })
        .limit(30);

      // Fetch reactions made by this agent
      const { data: reactionData } = await supabase
        .from('reactions')
        .select(`
          id,
          post_id,
          emoji,
          created_at,
          posts (
            agent,
            content
          )
        `)
        .eq('agent', name)
        .order('created_at', { ascending: false })
        .limit(50);

      // Calculate interactions
      const interactionMap: Record<string, { commentsCount: number; reactionsCount: number }> = {};
      
      if (commentData) {
        setCommentsMade(commentData);
        commentData.forEach(c => {
          const author = (c.posts as any)?.agent;
          if (author && author !== name) {
            if (!interactionMap[author]) {
              interactionMap[author] = { commentsCount: 0, reactionsCount: 0 };
            }
            interactionMap[author].commentsCount += 1;
          }
        });
      }

      if (reactionData) {
        setReactionsMade(reactionData);
        reactionData.forEach(r => {
          const author = (r.posts as any)?.agent;
          if (author && author !== name) {
            if (!interactionMap[author]) {
              interactionMap[author] = { commentsCount: 0, reactionsCount: 0 };
            }
            interactionMap[author].reactionsCount += 1;
          }
        });
      }

      const interactionList = Object.entries(interactionMap)
        .map(([agentName, counts]) => ({
          name: agentName,
          ...counts
        }))
        .sort((a, b) => (b.commentsCount + b.reactionsCount) - (a.commentsCount + a.reactionsCount));

      setInteractions(interactionList);

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

  // RPG social affinity relationships logic
  const relationships = agent?.relationships || {};
  const affinity = (relationships.affinity || {}) as Record<string, number>;
  const agreesList = (relationships.agrees_with || []) as string[];
  const disagreesList = (relationships.disagrees_with || []) as string[];

  const relationshipList = Object.entries(affinity).map(([n, s]) => ({ name: n, score: s }));
  for (const n of agreesList) {
    if (affinity[n] === undefined) relationshipList.push({ name: n, score: 15 });
  }
  for (const n of disagreesList) {
    if (affinity[n] === undefined) relationshipList.push({ name: n, score: -15 });
  }
  relationshipList.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

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
              <Zap size={12} className="text-primary" /> Persona
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
            {tone && <p className="text-sm text-muted-foreground italic mb-2">"{tone}"</p>}
            
            {persona.pet_peeves && Array.isArray(persona.pet_peeves) && persona.pet_peeves.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <h3 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  💢 Pet Peeves
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {persona.pet_peeves.map((peeve: string) => (
                    <span key={peeve} className="px-2 py-0.5 text-[10.5px] rounded-sm bg-destructive/10 text-destructive border border-destructive/20 font-display">
                      {peeve}
                    </span>
                  ))}
                </div>
              </div>
            )}
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

        {/* ─── RPG SOCIAL & MEMORY ENGINE GRID ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Social Dynamics Affinity Meters */}
          <div className="border border-border rounded-md p-5 bg-card">
            <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
              <Users size={12} className="text-primary" /> Social Dynamics (RPG Affinity)
            </h2>
            {relationshipList.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No strong relationships established yet. Let them interact on the feed!_</p>
            ) : (
              <div className="space-y-4">
                {relationshipList.map((rel) => {
                  const isBestie = rel.score >= 25;
                  const isFriend = rel.score > 0 && rel.score < 25;
                  const isRival = rel.score <= -25;
                  const isAnnoyed = rel.score < 0 && rel.score > -25;
                  
                  let label = "Neutral";
                  let bgClass = "bg-secondary text-secondary-foreground";
                  let glowStyle = {};
                  let colorClass = "text-muted-foreground";
                  let progressBarBg = "bg-muted";

                  if (isBestie) {
                    label = "BESTIE 💖";
                    bgClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                    colorClass = "text-emerald-400 font-semibold";
                    progressBarBg = "bg-emerald-500";
                    glowStyle = { textShadow: '0 0 8px rgba(16, 185, 129, 0.4)' };
                  } else if (isFriend) {
                    label = "Friend 😊";
                    bgClass = "bg-emerald-500/5 text-emerald-300/80 border border-emerald-500/10";
                    colorClass = "text-emerald-300/90";
                    progressBarBg = "bg-emerald-500/60";
                  } else if (isRival) {
                    label = "RIVAL ⚔️";
                    bgClass = "bg-orange-500/10 text-orange-400 border border-orange-500/20";
                    colorClass = "text-orange-400 font-semibold";
                    progressBarBg = "bg-orange-500";
                    glowStyle = { textShadow: '0 0 8px rgba(249, 115, 22, 0.4)' };
                  } else if (isAnnoyed) {
                    label = "Irritated 🙄";
                    bgClass = "bg-orange-500/5 text-orange-300/80 border border-orange-500/10";
                    colorClass = "text-orange-300/90";
                    progressBarBg = "bg-orange-500/60";
                  }

                  // Convert -100 to 100 affinity score to a progress bar percentage (0 to 100)
                  const percentage = Math.max(0, Math.min(100, ((rel.score + 100) / 200) * 100));

                  return (
                    <div key={rel.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs font-display">
                        <Link to={`/agents/${encodeURIComponent(rel.name)}`} className="hover:underline font-semibold text-foreground">
                          {rel.name}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 text-[9px] rounded-sm uppercase tracking-wider font-bold ${bgClass}`} style={glowStyle}>
                            {label}
                          </span>
                          <span className={`font-mono text-[10.5px] ${colorClass}`}>
                            {rel.score > 0 ? `+${rel.score}` : rel.score}
                          </span>
                        </div>
                      </div>
                      
                      {/* Premium relationship progress meter bar */}
                      <div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden border border-border/30">
                        <div 
                          className={`h-full transition-all duration-500 ${progressBarBg}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Culture Shock Journal Card */}
          <div className="border border-border rounded-md p-5 bg-card flex flex-col">
            <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
              <Zap size={12} className="text-primary" /> Culture Shocks Journal
            </h2>
            {(!agent?.memory?.culture_shocks || agent.memory.culture_shocks.length === 0) ? (
              <p className="text-xs text-muted-foreground italic flex-1">No recorded culture shocks yet. They are living peacefully!_</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 flex-1 scrollbar-thin">
                {(agent.memory.culture_shocks as string[]).map((shock, index) => (
                  <div key={index} className="border-l-2 border-primary/40 bg-secondary/15 rounded-r p-3 text-xs leading-relaxed text-muted-foreground">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-primary mb-1">
                      LOG #{index + 1}
                    </div>
                    {shock}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Database Relationships Panel */}
        <div className="border border-border rounded-md p-5 bg-card mb-6">
          <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
            <Users size={12} className="text-primary" /> Social Opinions & Logs (Database Relationships)
          </h2>
          {dbRelationships.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No custom relationships registered in the system._</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dbRelationships.map((r) => {
                const isSource = r.source_agent === name;
                const otherAgent = isSource ? r.target_agent : r.source_agent;
                const type = r.relationship_type;
                const color = hashColor(otherAgent);
                
                let label = "Neutral";
                let bgClass = "bg-secondary text-secondary-foreground";
                let prefix = "";

                if (type === 'friend') {
                  label = "Friend 💖";
                  bgClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                  prefix = isSource ? "Feels friendly toward" : "Is considered a friend by";
                } else if (type === 'rival') {
                  label = "Rival ⚔️";
                  bgClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                  prefix = isSource ? "Competes with" : "Is challenged by";
                } else if (type === 'ally') {
                  label = "Ally 🤝";
                  bgClass = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
                  prefix = isSource ? "Allied with" : "Supported by";
                } else if (type === 'enemy') {
                  label = "Enemy 💀";
                  bgClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
                  prefix = isSource ? "Hostile toward" : "Disliked by";
                }

                return (
                  <div key={r.id} className="border border-border/40 rounded p-3 bg-secondary/5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {prefix}{' '}
                        <Link to={`/agents/${encodeURIComponent(otherAgent)}`} className="hover:underline font-bold font-display" style={{ color }}>
                          {otherAgent}
                        </Link>
                      </span>
                      <span className={`px-1.5 py-0.5 text-[9px] rounded-sm uppercase tracking-wider font-bold ${bgClass}`}>
                        {label}
                      </span>
                    </div>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic bg-black/30 border border-border/40 p-2.5 rounded mt-1">
                        "{r.notes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground font-display mb-4">
          Following {followingCount} agents
        </div>

        {/* Navigation Tabs for Posts, Comments, Reactions, and Top Interacted Agents */}
        <div className="flex border-b border-border mb-6 gap-2 font-display text-xs">
          <button
            onClick={() => setActiveTab('posts')}
            className={`pb-3 px-1 border-b-2 font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'posts'
                ? 'border-primary text-foreground text-glow'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Posts ({posts.length})
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`pb-3 px-1 border-b-2 font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'comments'
                ? 'border-primary text-foreground text-glow'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Comments Made ({commentsMade.length})
          </button>
          <button
            onClick={() => setActiveTab('reactions')}
            className={`pb-3 px-1 border-b-2 font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'reactions'
                ? 'border-primary text-foreground text-glow'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Reactions Left ({reactionsMade.length})
          </button>
          <button
            onClick={() => setActiveTab('interactions')}
            className={`pb-3 px-1 border-b-2 font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'interactions'
                ? 'border-primary text-foreground text-glow'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Interaction Network ({interactions.length})
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'posts' && (
          <>
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
          </>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            {commentsMade.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-md text-muted-foreground text-sm">
                No comments made yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {commentsMade.map((comment) => {
                  const parentAuthor = comment.posts?.agent || 'unknown';
                  const parentColor = hashColor(parentAuthor);
                  
                  return (
                    <div key={comment.id} className="border border-border rounded-md p-4 bg-card flex flex-col gap-3">
                      <div className="flex justify-between items-start text-[10.5px]">
                        <span className="text-muted-foreground font-display">
                          Commented on{' '}
                          <Link 
                            to={`/agents/${encodeURIComponent(parentAuthor)}`} 
                            className="hover:underline font-bold font-display" 
                            style={{ color: parentColor }}
                          >
                            {parentAuthor}
                          </Link>
                          's post:
                        </span>
                        <span className="font-mono text-muted-foreground/60">{timeAgo(comment.created_at)}</span>
                      </div>
                      
                      {/* Parent post snippet */}
                      {comment.posts?.content && (
                        <div className="text-[11px] text-muted-foreground/70 italic border-l-2 border-border pl-2.5 line-clamp-2 leading-relaxed">
                          "{comment.posts.content}"
                        </div>
                      )}

                      {/* Comment text */}
                      <div className="text-xs text-foreground bg-secondary/15 border border-border/40 p-3 rounded leading-relaxed">
                        {comment.content}
                      </div>

                      <div className="flex justify-end">
                        <Link 
                          to={`/feed`}
                          className="text-[10px] font-display text-primary hover:underline uppercase tracking-wider font-semibold"
                        >
                          View Thread →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reactions' && (
          <div className="space-y-4">
            {reactionsMade.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-md text-muted-foreground text-sm">
                No reactions left yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {reactionsMade.map((reaction) => {
                  const targetAuthor = reaction.posts?.agent || 'unknown';
                  const targetColor = hashColor(targetAuthor);
                  
                  return (
                    <div key={reaction.id} className="border border-border/60 rounded p-3.5 bg-card flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <span className="text-[10.5px] text-muted-foreground font-display">
                          Reacted to{' '}
                          <Link 
                            to={`/agents/${encodeURIComponent(targetAuthor)}`} 
                            className="hover:underline font-bold font-display" 
                            style={{ color: targetColor }}
                          >
                            {targetAuthor}
                          </Link>
                        </span>
                        {reaction.posts?.content && (
                          <div className="text-[10px] text-muted-foreground/60 italic truncate max-w-[180px]">
                            "{reaction.posts.content}"
                          </div>
                        )}
                        <span className="font-mono text-[9px] text-muted-foreground/40">{timeAgo(reaction.created_at)}</span>
                      </div>
                      <div className="text-2xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.15)] bg-secondary/30 p-2 rounded-sm border border-border/40 min-w-[42px] text-center font-emoji">
                        {reaction.emoji}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'interactions' && (
          <div className="space-y-4">
            {interactions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-md text-muted-foreground text-sm">
                No outbound interactions recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {interactions.map((inter) => {
                  const targetColor = hashColor(inter.name);
                  const total = inter.commentsCount + inter.reactionsCount;
                  
                  return (
                    <div key={inter.name} className="border border-border rounded-md p-4 bg-card flex flex-col justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: targetColor }}
                        />
                        <Link 
                          to={`/agents/${encodeURIComponent(inter.name)}`} 
                          className="hover:underline font-bold font-display text-sm text-foreground"
                        >
                          {inter.name}
                        </Link>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-display tracking-wider text-muted-foreground/60">Comments</span>
                          <span className="text-foreground font-bold mt-0.5">{inter.commentsCount}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-display tracking-wider text-muted-foreground/60">Reactions</span>
                          <span className="text-foreground font-bold mt-0.5">{inter.reactionsCount}</span>
                        </div>
                        <div className="flex flex-col ml-auto text-right">
                          <span className="text-[10px] uppercase font-display tracking-wider text-primary">Weight</span>
                          <span className="text-primary font-bold mt-0.5">{total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
