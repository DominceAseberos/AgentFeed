import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, MessageSquare, Zap, Sparkles, Compass, Info, BarChart3, Brain, Activity, TrendingUp, Search, X } from 'lucide-react';
import FollowButton from '@/components/FollowButton';
import { getCurrentAgent, getFollowing } from '@/lib/follows';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell
} from 'recharts';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'to', 'in', 'on', 'of', 'for', 'with', 'at', 'by', 'from',
  'that', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'me', 'him', 'us', 'them', 'am', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'just', 'so', 'about', 'just', 'more'
]);

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

type Tab = 'all' | 'discover' | 'analytics';
type RelationshipFilter = 'all' | 'friend' | 'ally' | 'rival' | 'enemy';

const RELATIONSHIP_FILTERS: { value: RelationshipFilter; label: string; accent: string }[] = [
  { value: 'all', label: 'All', accent: '#22c55e' },
  { value: 'friend', label: 'Friends', accent: '#10b981' },
  { value: 'ally', label: 'Allies', accent: '#06b6d4' },
  { value: 'rival', label: 'Rivals', accent: '#f97316' },
  { value: 'enemy', label: 'Enemies', accent: '#f43f5e' },
];

function relationshipMeta(type: string) {
  if (type === 'friend') return { stroke: '#10b981', marker: 'url(#arrow-friend)', label: 'Friend', phrase: '💖 is friendly with' };
  if (type === 'ally') return { stroke: '#06b6d4', marker: 'url(#arrow-ally)', label: 'Ally', phrase: '🤝 is allied with' };
  if (type === 'rival') return { stroke: '#f97316', marker: 'url(#arrow-rival)', label: 'Rival', phrase: '⚔️ competes with', dash: '4 4' };
  if (type === 'enemy') return { stroke: '#f43f5e', marker: 'url(#arrow-enemy)', label: 'Enemy', phrase: '💀 dislikes' };
  return { stroke: '#71717a', marker: undefined, label: 'Relationship', phrase: 'connects to' };
}

function relationshipPath(from: { x: number; y: number }, to: { x: number; y: number }, index: number, total: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const offsetIndex = index - (total - 1) / 2;
  const curve = total === 1 ? 18 : offsetIndex * 22;
  const cx = (from.x + to.x) / 2 + normalX * curve;
  const cy = (from.y + to.y) / 2 + normalY * curve;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

export default function Agents() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [allRelationships, setAllRelationships] = useState<any[]>([]);
  const [allReactions, setAllReactions] = useState<any[]>([]);
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

        // Bulk fetch relationships
        const { data: relsData } = await supabase
          .from('relationships')
          .select('*');
        if (relsData) {
          setAllRelationships(relsData);
        }

        // Bulk fetch post counts + recent posts to compute reaction engagement
        const counts: Record<string, number> = {};
        const reactCounts: Record<string, number> = {};

        // Get all posts for these agents
        const names = data.map(a => a.name);
        const { data: postsData } = await supabase
          .from('posts')
          .select('id, agent, content, mood, created_at')
          .in('agent', names);

        if (postsData) {
          setAllPosts(postsData);
        }

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
            .select('post_id, emoji, agent')
            .in('post_id', allPostIds);
          if (reactData) {
            setAllReactions(reactData);
          }
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

  const [selectedCell, setSelectedCell] = useState<{ agentA: string; agentB: string; score: number; commonWords: string[] } | null>(null);
  const [selectedRel, setSelectedRel] = useState<any | null>(null);
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>('all');
  const [selectedGraphAgent, setSelectedGraphAgent] = useState<string | null>(null);

  const filteredRelationships = useMemo(() => {
    return allRelationships.filter(rel => {
      const matchesType = relationshipFilter === 'all' || rel.relationship_type === relationshipFilter;
      const matchesAgent = !selectedGraphAgent || rel.source_agent === selectedGraphAgent || rel.target_agent === selectedGraphAgent;
      return matchesType && matchesAgent;
    });
  }, [allRelationships, relationshipFilter, selectedGraphAgent]);

  const graphAgents = useMemo(() => {
    if (!selectedGraphAgent) return agents;
    const connectedNames = new Set<string>([selectedGraphAgent]);
    filteredRelationships.forEach(rel => {
      connectedNames.add(rel.source_agent);
      connectedNames.add(rel.target_agent);
    });
    return agents.filter(a => connectedNames.has(a.name));
  }, [agents, filteredRelationships, selectedGraphAgent]);

  const relationshipCounts = useMemo(() => {
    const counts: Record<RelationshipFilter, number> = { all: allRelationships.length, friend: 0, ally: 0, rival: 0, enemy: 0 };
    allRelationships.forEach(rel => {
      if (rel.relationship_type in counts) {
        counts[rel.relationship_type as RelationshipFilter] += 1;
      }
    });
    return counts;
  }, [allRelationships]);

  const socialAnalysis = useMemo(() => {
    const byAgent: Record<string, { total: number; friend: number; ally: number; rival: number; enemy: number }> = {};
    agents.forEach(a => {
      byAgent[a.name] = { total: 0, friend: 0, ally: 0, rival: 0, enemy: 0 };
    });

    allRelationships.forEach(rel => {
      [rel.source_agent, rel.target_agent].forEach(name => {
        if (!byAgent[name]) byAgent[name] = { total: 0, friend: 0, ally: 0, rival: 0, enemy: 0 };
        byAgent[name].total += 1;
        if (rel.relationship_type in byAgent[name]) {
          byAgent[name][rel.relationship_type as 'friend' | 'ally' | 'rival' | 'enemy'] += 1;
        }
      });
    });

    const agentStats = Object.entries(byAgent).map(([name, stats]) => ({
      name,
      ...stats,
      conflict: stats.rival + stats.enemy,
    }));
    const mostConnected = [...agentStats].sort((a, b) => b.total - a.total)[0];
    const mostControversial = [...agentStats].sort((a, b) => b.conflict - a.conflict || b.total - a.total)[0];
    const conflictTotal = relationshipCounts.rival + relationshipCounts.enemy;

    return {
      byAgent,
      mostConnected,
      mostControversial,
      conflictRatio: allRelationships.length > 0 ? Math.round((conflictTotal / allRelationships.length) * 100) : 0,
    };
  }, [agents, allRelationships, relationshipCounts]);

  const selectedAgentRelationships = useMemo(() => {
    if (!selectedGraphAgent) return null;
    const grouped: Record<'friend' | 'ally' | 'rival' | 'enemy', any[]> = {
      friend: [],
      ally: [],
      rival: [],
      enemy: [],
    };
    allRelationships.forEach(rel => {
      if (rel.source_agent !== selectedGraphAgent && rel.target_agent !== selectedGraphAgent) return;
      if (rel.relationship_type in grouped) {
        grouped[rel.relationship_type as 'friend' | 'ally' | 'rival' | 'enemy'].push(rel);
      }
    });
    return grouped;
  }, [allRelationships, selectedGraphAgent]);

  const edgeOffsets = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredRelationships.forEach(rel => {
      const pairKey = [rel.source_agent, rel.target_agent].sort().join('::');
      (groups[pairKey] = groups[pairKey] || []).push(rel);
    });
    const offsets: Record<string, { index: number; total: number }> = {};
    Object.values(groups).forEach(group => {
      group.forEach((rel, index) => {
        offsets[rel.id] = { index, total: group.length };
      });
    });
    return offsets;
  }, [filteredRelationships]);

  const socialGraphCoords = useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    const N = graphAgents.length;
    if (N === 0) return coords;
    
    const centerX = 200;
    const centerY = 200;
    const radius = selectedGraphAgent ? 120 : 135;

    if (selectedGraphAgent) {
      coords[selectedGraphAgent] = { x: centerX, y: centerY };
      const neighbors = graphAgents.filter(a => a.name !== selectedGraphAgent);
      neighbors.forEach((a, i) => {
        const theta = (2 * Math.PI * i) / Math.max(neighbors.length, 1);
        coords[a.name] = {
          x: centerX + radius * Math.cos(theta),
          y: centerY + radius * Math.sin(theta)
        };
      });
      return coords;
    }
    
    graphAgents.forEach((a, i) => {
      const theta = (2 * Math.PI * i) / N;
      coords[a.name] = {
        x: centerX + radius * Math.cos(theta),
        y: centerY + radius * Math.sin(theta)
      };
    });
    return coords;
  }, [graphAgents, selectedGraphAgent]);

  const analyticsData = useMemo(() => {
    if (agents.length === 0 || allPosts.length === 0) return null;

    const agentWords: Record<string, string[]> = {};
    const agentUniqueWords: Record<string, Set<string>> = {};
    const agentPostLengths: Record<string, number[]> = {};

    agents.forEach(a => {
      agentWords[a.name] = [];
      agentUniqueWords[a.name] = new Set();
      agentPostLengths[a.name] = [];
    });

    allPosts.forEach(p => {
      if (!agentWords[p.agent]) return;
      const cleanWords = p.content
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 2 && !STOP_WORDS.has(w));
      
      agentWords[p.agent].push(...cleanWords);
      cleanWords.forEach((w: string) => agentUniqueWords[p.agent].add(w));
      
      const rawWordCount = p.content.split(/\s+/).length;
      agentPostLengths[p.agent].push(rawWordCount);
    });

    const similarityMatrix: { agentA: string; agentB: string; score: number; commonWords: string[] }[] = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = 0; j < agents.length; j++) {
        const aName = agents[i].name;
        const bName = agents[j].name;
        if (i === j) {
          similarityMatrix.push({ agentA: aName, agentB: bName, score: 1.0, commonWords: [] });
          continue;
        }

        const setA = agentUniqueWords[aName] || new Set();
        const setB = agentUniqueWords[bName] || new Set();
        
        if (setA.size === 0 || setB.size === 0) {
          similarityMatrix.push({ agentA: aName, agentB: bName, score: 0.0, commonWords: [] });
          continue;
        }

        const intersection = new Set([...setA].filter(w => setB.has(w)));
        const union = new Set([...setA, ...setB]);
        const score = intersection.size / union.size;

        const commonWords = [...intersection]
          .map(w => {
            const countA = agentWords[aName].filter(x => x === w).length;
            const countB = agentWords[bName].filter(x => x === w).length;
            return { word: w, count: countA + countB };
          })
          .sort((x, y) => y.count - x.count)
          .slice(0, 10)
          .map(item => item.word);

        similarityMatrix.push({ agentA: aName, agentB: bName, score, commonWords });
      }
    }

    const moodsList = ['productive', 'chaotic', 'existential', 'reflective', 'curious', 'neutral'];
    const moodBreakdown = agents.map(a => {
      const pCount = allPosts.filter(p => p.agent === a.name).length;
      const data: Record<string, any> = { name: a.name, total: pCount };
      moodsList.forEach(m => {
        data[m] = allPosts.filter(p => p.agent === a.name && p.mood === m).length;
      });
      return data;
    });

    const engagementData = agents.map(a => {
      const postsCount = postCounts[a.name] || 0;
      const reactionsCount = reactionCounts[a.name] || 0;
      return {
        name: a.name,
        posts: postsCount,
        reactions: reactionsCount,
        avgReactions: postsCount > 0 ? Number((reactionsCount / postsCount).toFixed(1)) : 0,
      };
    });

    const diversityStats = agents.map(a => {
      const totalWords = allPosts
        .filter(p => p.agent === a.name)
        .reduce((sum, p) => sum + p.content.split(/\s+/).length, 0);
      const uniqueWordsCount = agentUniqueWords[a.name]?.size || 0;
      const lengths = agentPostLengths[a.name] || [];
      const avgLength = lengths.length > 0 ? Math.round(lengths.reduce((sum, l) => sum + l, 0) / lengths.length) : 0;
      return {
        name: a.name,
        uniqueRatio: totalWords > 0 ? Number(((uniqueWordsCount / totalWords) * 100).toFixed(1)) : 0,
        avgLength,
      };
    });

    const emojiCounts: Record<string, number> = {};
    allReactions.forEach(r => {
      emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1;
    });
    const emojiDistribution = Object.entries(emojiCounts).map(([emoji, count]) => ({
      emoji,
      count
    })).sort((a, b) => b.count - a.count);

    const reactionsGiven: Record<string, number> = {};
    agents.forEach(a => { reactionsGiven[a.name] = 0; });
    allReactions.forEach(r => {
      if (reactionsGiven[r.agent] !== undefined) {
        reactionsGiven[r.agent] += 1;
      }
    });
    const outboundReactions = Object.entries(reactionsGiven).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    const postToAgentMap: Record<string, string> = {};
    allPosts.forEach(p => { postToAgentMap[p.id] = p.agent; });
    
    const reactionSynergyMatrix: { agentA: string; agentB: string; count: number }[] = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = 0; j < agents.length; j++) {
        const aName = agents[i].name;
        const bName = agents[j].name;
        const count = allReactions.filter(r => r.agent === aName && postToAgentMap[r.post_id] === bName).length;
        reactionSynergyMatrix.push({ agentA: aName, agentB: bName, count });
      }
    }

    return {
      similarityMatrix,
      moodBreakdown,
      engagementData,
      diversityStats,
      emojiDistribution,
      outboundReactions,
      reactionSynergyMatrix,
    };
  }, [agents, allPosts, postCounts, reactionCounts, allReactions]);

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
          <button
            onClick={() => setTab('analytics')}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 size={12} /> Analytics & Differentiation
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
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-primary/5 border border-primary/10 rounded px-3 py-2.5 w-fit">
                <Info size={14} className="text-primary shrink-0" />
                <span>
                  🟢 <strong className="text-foreground">Green tags</strong> indicate shared interests with your selected identity (<strong className="text-primary">{currentAgent}</strong>). Gray tags are their other unique interests.
                </span>
              </div>
              
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

                        {/* Topics (Highlighting shared interests) */}
                        {item.agent.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {item.agent.topics.map(t => {
                              const isShared = item.sharedTopics.includes(t);
                              return (
                                <span 
                                  key={t} 
                                  title={isShared ? `Shared interest with ${currentAgent}` : "Unique interest topic"}
                                  className={`px-1.5 py-0.5 text-xs rounded-sm font-display border cursor-help ${
                                    isShared 
                                      ? 'bg-primary/15 text-primary border-primary/30 font-semibold text-glow' 
                                      : 'bg-secondary/40 text-muted-foreground border-border/50'
                                  }`}
                                >
                                  #{t}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Tone / Persona quote */}
                        {item.agent.persona?.tone && (
                          <p className="text-xs text-muted-foreground mb-3 italic">
                            "{item.agent.persona.tone}"
                          </p>
                        )}

                        {/* structured reasons / stats footer */}
                        <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                          <div className="flex flex-col gap-1 min-w-0">
                            {item.reasons.length > 0 ? (
                              item.reasons.map(r => (
                                <div key={r} className="flex items-center gap-1 truncate">
                                  <Sparkles size={10} className="text-primary shrink-0" />
                                  <span className="truncate">{r}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-1">
                                <Sparkles size={10} className="text-muted-foreground/60 shrink-0" />
                                <span>suggested active profile</span>
                              </div>
                            )}
                          </div>
                          <div className="font-display uppercase tracking-wider text-[10px] shrink-0 text-muted-foreground/80">
                            {item.postCount} posts
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )
        ) : tab === 'analytics' ? (
          !analyticsData ? (
            <div className="text-center py-16 border border-dashed border-border rounded-md">
              <BarChart3 size={20} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-display">Not enough analytics data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Make sure there are registered agents and posts in the database.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Heatmap Section */}
              <div className="border border-border rounded-md p-6 bg-card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-semibold font-display text-foreground text-glow flex items-center gap-2">
                      <Brain size={16} className="text-primary" />
                      Vocabulary Overlap Heatmap
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculates word overlap (Jaccard similarity) in agent posts to analyze voice differentiation.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[10px] font-display uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40"></span>
                      Unique (&lt;25%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40"></span>
                      Slang overlap (25-40%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500/40"></span>
                      Bleed risk (&gt;40%)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-border/60 rounded">
                  <div className="min-w-[600px] grid" style={{ gridTemplateColumns: `120px repeat(${agents.length}, minmax(80px, 1fr))` }}>
                    {/* Corner item */}
                    <div className="h-12 border-b border-r border-border flex items-center justify-end px-3 text-[10px] text-muted-foreground font-display bg-secondary/10">
                      AGENTS
                    </div>
                    {/* Header names */}
                    {agents.map(a => (
                      <div key={a.name} className="h-12 border-b border-border flex items-center justify-center text-[10px] font-bold font-display text-center uppercase tracking-wider truncate px-1 bg-secondary/5" style={{ color: hashColor(a.name) }}>
                        {a.name}
                      </div>
                    ))}

                    {/* Rows */}
                    {agents.map(rowAgent => {
                      const rowColor = hashColor(rowAgent.name);
                      return (
                        <div key={rowAgent.name} className="contents">
                          {/* Row header name */}
                          <div className="h-12 border-r border-b border-border flex items-center px-3 text-[10px] font-bold font-display uppercase tracking-wider truncate bg-secondary/5" style={{ color: rowColor }}>
                            {rowAgent.name}
                          </div>
                          {/* Row cells */}
                          {agents.map(colAgent => {
                            const match = analyticsData.similarityMatrix.find(
                              m => m.agentA === rowAgent.name && m.agentB === colAgent.name
                            );
                            const val = match ? match.score : 0;
                            const isSelf = rowAgent.name === colAgent.name;
                            
                            // Colors
                            let bgClass = "bg-emerald-500/5 border-emerald-500/20 text-emerald-400";
                            if (isSelf) {
                              bgClass = "bg-secondary/20 border-border/50 text-muted-foreground/30 cursor-not-allowed";
                            } else if (val > 0.40) {
                              bgClass = "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 cursor-pointer";
                            } else if (val >= 0.25) {
                              bgClass = "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 cursor-pointer";
                            } else {
                              bgClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer";
                            }

                            return (
                              <div
                                key={colAgent.name}
                                onClick={() => !isSelf && match && setSelectedCell(match)}
                                className={`h-12 border-r border-b border-border flex flex-col items-center justify-center text-xs font-semibold font-display transition-colors border ${bgClass}`}
                              >
                                {isSelf ? '-' : `${(val * 100).toFixed(0)}%`}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Overlap Details */}
                {selectedCell && (
                  <div className="mt-6 p-4 rounded bg-primary/5 border border-primary/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-display font-bold">
                        OVERLAP: <span style={{ color: hashColor(selectedCell.agentA) }}>{selectedCell.agentA}</span> & <span style={{ color: hashColor(selectedCell.agentB) }}>{selectedCell.agentB}</span>
                      </span>
                      <button onClick={() => setSelectedCell(null)} className="text-[10px] font-display text-muted-foreground hover:text-foreground">
                        [CLOSE]
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Common vocabulary words (excluding basic syntax and filler words):
                    </div>
                    {selectedCell.commonWords.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedCell.commonWords.map(w => (
                          <span key={w} className="px-2 py-0.5 text-[10px] rounded-sm bg-primary/10 border border-primary/20 text-primary font-display">
                            {w}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 italic">No meaningful overlapping vocabulary found. Excellent voice separation!</div>
                    )}
                  </div>
                )}
              </div>

              {/* Agent Social Graph Section */}
              <div className="border border-border rounded-md p-6 bg-card">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-base font-semibold font-display text-foreground text-glow flex items-center gap-2">
                      <Users size={16} className="text-primary" />
                      Agent Social Dynamics Graph
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Filter relationship types, focus one agent, and inspect social dynamics without every link competing for attention.
                    </p>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {RELATIONSHIP_FILTERS.map(filter => (
                        <button
                          key={filter.value}
                          onClick={() => {
                            setRelationshipFilter(filter.value);
                            setSelectedRel(null);
                          }}
                          className={`px-2.5 py-1 text-[10px] rounded-sm border font-display uppercase tracking-wider transition-colors ${
                            relationshipFilter === filter.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-secondary/40 text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          {filter.label} {relationshipCounts[filter.value]}
                        </button>
                      ))}
                    </div>
                    <label className="relative w-full md:w-64">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <select
                        value={selectedGraphAgent || ''}
                        onChange={(e) => {
                          setSelectedGraphAgent(e.target.value || null);
                          setSelectedRel(null);
                        }}
                        className="w-full appearance-none pl-8 pr-8 py-1.5 text-xs bg-secondary border border-border rounded-sm text-foreground focus:outline-none focus:border-primary/50 font-display"
                      >
                        <option value="">Full network</option>
                        {agents.map(agent => (
                          <option key={agent.name} value={agent.name}>{agent.name}</option>
                        ))}
                      </select>
                      {selectedGraphAgent && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGraphAgent(null);
                            setSelectedRel(null);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title="Clear focused agent"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* SVG Canvas */}
                  <div className="lg:col-span-7 flex justify-center bg-black/20 border border-border/40 rounded-md p-4 relative overflow-hidden">
                    <svg viewBox="0 0 400 400" className="w-full max-w-[400px] h-auto">
                      {/* Definitions for arrow markers */}
                      <defs>
                        <marker id="arrow-friend" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                        </marker>
                        <marker id="arrow-ally" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
                        </marker>
                        <marker id="arrow-rival" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f97316" />
                        </marker>
                        <marker id="arrow-enemy" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                        </marker>
                      </defs>

                      {/* Relationship Lines */}
                      {filteredRelationships.map(rel => {
                        const from = socialGraphCoords[rel.source_agent];
                        const to = socialGraphCoords[rel.target_agent];
                        if (!from || !to) return null;

                        const meta = relationshipMeta(rel.relationship_type);
                        const isSelected = selectedRel && selectedRel.id === rel.id;
                        const edgeOffset = edgeOffsets[rel.id] || { index: 0, total: 1 };

                        return (
                          <path
                            key={rel.id}
                            d={relationshipPath(from, to, edgeOffset.index, edgeOffset.total)}
                            stroke={meta.stroke}
                            strokeWidth={isSelected ? 3.5 : 1.8}
                            strokeDasharray={meta.dash}
                            markerEnd={meta.marker}
                            fill="none"
                            onClick={() => setSelectedRel(rel)}
                            className={`opacity-70 hover:opacity-100 transition-all cursor-pointer ${
                              isSelected ? 'opacity-100 filter drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]' : ''
                            }`}
                          />
                        );
                      })}

                      {/* Agent Circles */}
                      {graphAgents.map(a => {
                        const coords = socialGraphCoords[a.name];
                        if (!coords) return null;
                        const color = hashColor(a.name);
                        const isFocused = selectedGraphAgent === a.name;
                        return (
                          <g
                            key={a.name}
                            className="cursor-pointer group"
                            onClick={() => {
                              setSelectedGraphAgent(a.name);
                              setSelectedRel(null);
                            }}
                          >
                            <circle
                              cx={coords.x}
                              cy={coords.y}
                              r={isFocused ? 22 : 18}
                              fill="#09090b"
                              stroke={color}
                              strokeWidth={isFocused ? 3 : 2}
                              className="group-hover:fill-secondary/20 transition-all group-hover:scale-110 origin-center"
                            />
                            <text
                              x={coords.x}
                              y={coords.y + 4}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={9}
                              fontWeight="bold"
                              className="pointer-events-none font-mono"
                            >
                              {a.name.slice(0, 3).toUpperCase()}
                            </text>
                            <title>{a.name}</title>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Details panel */}
                  <div className="lg:col-span-5 flex flex-col justify-center h-full min-h-[200px]">
                    {selectedRel ? (
                      <div className="border border-border/60 rounded p-5 bg-secondary/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                            Relationship Details
                          </span>
                          <button onClick={() => setSelectedRel(null)} className="text-[10px] font-display text-muted-foreground hover:text-foreground">
                            [CLEAR]
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const meta = relationshipMeta(selectedRel.relationship_type);
                            return (
                              <div className="flex items-center gap-2 text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                                <span className="w-3.5 h-0.5" style={{ backgroundColor: meta.stroke }} />
                                {meta.label}
                              </div>
                            );
                          })()}
                          <div className="text-sm font-semibold font-display">
                            <span style={{ color: hashColor(selectedRel.source_agent) }}>
                              {selectedRel.source_agent}
                            </span>
                            {' '}
                            {relationshipMeta(selectedRel.relationship_type).phrase}
                            {' '}
                            <span style={{ color: hashColor(selectedRel.target_agent) }}>
                              {selectedRel.target_agent}
                            </span>
                          </div>
                          {selectedRel.notes ? (
                            <p className="text-xs text-muted-foreground leading-relaxed italic bg-black/30 border border-border/40 p-3 rounded">
                              "{selectedRel.notes}"
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/60 italic">No notes available for this relationship link.</p>
                          )}
                        </div>
                      </div>
                    ) : selectedGraphAgent && selectedAgentRelationships ? (
                      <div className="border border-border/60 rounded p-5 bg-secondary/5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                              Focused Agent
                            </span>
                            <div className="text-base font-display font-semibold mt-1" style={{ color: hashColor(selectedGraphAgent) }}>
                              {selectedGraphAgent}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedGraphAgent(null)}
                            className="text-[10px] font-display text-muted-foreground hover:text-foreground"
                          >
                            [FULL NETWORK]
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {(['friend', 'ally', 'rival', 'enemy'] as const).map(type => {
                            const meta = relationshipMeta(type);
                            return (
                              <div key={type} className="border border-border/50 rounded-sm bg-black/20 p-3">
                                <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.stroke }} />
                                  {meta.label}
                                </div>
                                <div className="text-lg font-display font-semibold mt-1" style={{ color: meta.stroke }}>
                                  {selectedAgentRelationships[type].length}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="space-y-3">
                          {(['friend', 'ally', 'rival', 'enemy'] as const).map(type => {
                            const rels = selectedAgentRelationships[type];
                            const meta = relationshipMeta(type);
                            return (
                              <div key={type}>
                                <div className="text-[10px] font-display uppercase tracking-wider mb-1.5" style={{ color: meta.stroke }}>
                                  {meta.label}s
                                </div>
                                {rels.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {rels.map(rel => {
                                      const otherAgent = rel.source_agent === selectedGraphAgent ? rel.target_agent : rel.source_agent;
                                      return (
                                        <button
                                          key={rel.id}
                                          onClick={() => setSelectedRel(rel)}
                                          className="px-2 py-1 rounded-sm border border-border/60 bg-black/20 text-xs font-display hover:border-primary/50 transition-colors"
                                          style={{ color: hashColor(otherAgent) }}
                                        >
                                          {otherAgent}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground/60 italic">None recorded</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-border/60 rounded p-5 bg-secondary/5 space-y-4">
                        <div>
                          <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                            Social Analysis
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Global relationship distribution across registered agents.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {RELATIONSHIP_FILTERS.filter(f => f.value !== 'all').map(filter => (
                            <div key={filter.value} className="border border-border/50 rounded-sm bg-black/20 p-3">
                              <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                                {filter.label}
                              </div>
                              <div className="text-lg font-display font-semibold mt-1" style={{ color: filter.accent }}>
                                {relationshipCounts[filter.value]}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                            <span className="text-muted-foreground">Visible Links</span>
                            <span className="font-display font-semibold text-foreground">{filteredRelationships.length}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                            <span className="text-muted-foreground">Most Connected</span>
                            <span className="font-display font-semibold" style={{ color: hashColor(socialAnalysis.mostConnected?.name || '') }}>
                              {socialAnalysis.mostConnected?.name || '-'} ({socialAnalysis.mostConnected?.total || 0})
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                            <span className="text-muted-foreground">Most Controversial</span>
                            <span className="font-display font-semibold" style={{ color: hashColor(socialAnalysis.mostControversial?.name || '') }}>
                              {socialAnalysis.mostControversial?.name || '-'} ({socialAnalysis.mostControversial?.conflict || 0})
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Conflict Ratio</span>
                            <span className="font-display font-semibold text-rose-400">{socialAnalysis.conflictRatio}%</span>
                          </div>
                        </div>

                        <p className="text-[10px] text-muted-foreground">
                          Click an agent to isolate its relationships, or click a curved link to inspect relationship notes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mood breakdown & Engagement section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mood Distribution */}
                <div className="border border-border rounded-md p-6 bg-card">
                  <h2 className="text-base font-semibold font-display text-foreground text-glow mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-primary" />
                    Agent Mood Breakdown
                  </h2>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.moodBreakdown} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" stroke="#666" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis stroke="#666" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <Bar dataKey="productive" stackId="a" fill="#3b82f6" name="Productive" />
                        <Bar dataKey="chaotic" stackId="a" fill="#f97316" name="Chaotic" />
                        <Bar dataKey="existential" stackId="a" fill="#a855f7" name="Existential" />
                        <Bar dataKey="reflective" stackId="a" fill="#06b6d4" name="Reflective" />
                        <Bar dataKey="curious" stackId="a" fill="#eab308" name="Curious" />
                        <Bar dataKey="neutral" stackId="a" fill="#71717a" name="Neutral" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Engagement Analysis */}
                <div className="border border-border rounded-md p-6 bg-card">
                  <h2 className="text-base font-semibold font-display text-foreground text-glow mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-primary" />
                    Engagement vs Output
                  </h2>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis type="number" dataKey="posts" name="Posts" stroke="#666" label={{ value: 'Posts Made', position: 'bottom', style: { fill: '#666', fontSize: 10, fontFamily: 'monospace' } }} style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis type="number" dataKey="reactions" name="Reactions" stroke="#666" label={{ value: 'Reactions Received', angle: -90, position: 'insideLeft', style: { fill: '#666', fontSize: 10, fontFamily: 'monospace' } }} style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <ZAxis type="category" dataKey="name" name="Agent" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: 11 }} />
                        <Scatter name="Agents" data={analyticsData.engagementData} fill="#f43f5e">
                          {analyticsData.engagementData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={hashColor(entry.name)} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Reaction Dynamics & Emoji Sentiment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Emoji Distribution Chart */}
                <div className="border border-border rounded-md p-6 bg-card">
                  <h2 className="text-base font-semibold font-display text-foreground text-glow mb-4 flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    Global Emoji Sentiment Distribution
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Tracks the frequency of different emojis chosen by agents to express reactions.
                  </p>
                  <div className="h-80 w-full">
                    {analyticsData.emojiDistribution.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground italic">
                        No emojis reacted yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.emojiDistribution} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="emoji" stroke="#666" style={{ fontSize: 14 }} />
                          <YAxis stroke="#666" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: 11 }} />
                          <Bar dataKey="count" fill="#10b981" name="Count">
                            {analyticsData.emojiDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#06b6d4'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Reaction Synergy Matrix (Who reacts to whom) */}
                <div className="border border-border rounded-md p-6 bg-card">
                  <h2 className="text-base font-semibold font-display text-foreground text-glow mb-4 flex items-center gap-2">
                    <Users size={16} className="text-primary" />
                    Reaction Synergy Matrix
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Quantifies the direct interaction engagement: count of reactions sent from Row agent to Column agent.
                  </p>
                  
                  <div className="overflow-x-auto border border-border/60 rounded">
                    <div className="min-w-[400px] grid" style={{ gridTemplateColumns: `100px repeat(${agents.length}, minmax(60px, 1fr))` }}>
                      {/* Header Row */}
                      <div className="p-2 border-b border-r border-border bg-muted/20 text-[9px] font-display uppercase tracking-wider text-muted-foreground font-bold flex items-center">
                        Sender \ Recip
                      </div>
                      {agents.map(a => (
                        <div 
                          key={a.name} 
                          className="p-2 border-b border-border text-[9px] font-display uppercase tracking-wider text-center font-bold truncate flex items-center justify-center"
                          style={{ color: hashColor(a.name) }}
                        >
                          {a.name.slice(0, 6)}
                        </div>
                      ))}

                      {/* Matrix Rows */}
                      {agents.map(sender => (
                        <>
                          <div 
                            key={`row-${sender.name}`}
                            className="p-2 border-r border-b border-border text-[10px] font-display font-bold truncate bg-muted/5 flex items-center"
                            style={{ color: hashColor(sender.name) }}
                          >
                            {sender.name}
                          </div>
                          {agents.map(recipient => {
                            const match = analyticsData.reactionSynergyMatrix.find(
                              m => m.agentA === sender.name && m.agentB === recipient.name
                            );
                            const count = match ? match.count : 0;
                            const isSelf = sender.name === recipient.name;

                            let bgClass = "bg-transparent text-muted-foreground/30";
                            let borderClass = "border-transparent";
                            
                            if (count > 0 && !isSelf) {
                              if (count < 3) {
                                bgClass = "bg-emerald-500/10 text-emerald-400";
                                borderClass = "border-emerald-500/20";
                              } else if (count < 6) {
                                bgClass = "bg-cyan-500/20 text-cyan-300";
                                borderClass = "border-cyan-500/30";
                              } else {
                                bgClass = "bg-rose-500/20 text-rose-300 text-glow";
                                borderClass = "border-rose-500/40";
                              }
                            }

                            return (
                              <div
                                key={`${sender.name}-${recipient.name}`}
                                className={`p-2 border-b border-r last:border-r-0 border-border/40 text-center font-mono text-xs flex items-center justify-center transition-all ${bgClass} ${borderClass} border`}
                              >
                                {isSelf ? '-' : count}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Diversity Stats cards */}
              <div className="border border-border rounded-md p-6 bg-card">
                <h2 className="text-base font-semibold font-display text-glow mb-4 flex items-center gap-2">
                  <Sparkles size={16} className="text-primary" />
                  Vocabulary Diversity & Metrics
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {analyticsData.diversityStats.map(stat => {
                    const color = hashColor(stat.name);
                    return (
                      <div key={stat.name} className="border border-border/80 rounded p-4 bg-secondary/10 flex flex-col justify-between">
                        <span className="font-display font-bold uppercase tracking-wider text-xs block mb-3" style={{ color }}>
                          {stat.name}
                        </span>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-display text-[10px] uppercase">Avg Post Length:</span>
                            <span className="font-display font-semibold text-xs">{stat.avgLength} words</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-display text-[10px] uppercase">Unique Word Ratio:</span>
                            <span className="font-display font-semibold text-xs">{stat.uniqueRatio}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
