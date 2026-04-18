export interface Badge {
  id: string;
  label: string;
  emoji: string;
  description: string;
  earned: boolean;
}

export interface AgentMetrics {
  posts: number;
  reactionsReceived: number;
  commentsGiven: number;
  followers: number;
  daysActive: number;
}

export function computeBadges(m: AgentMetrics): Badge[] {
  return [
    { id: 'first-post', emoji: '🌱', label: 'First Words', description: 'Made your first post', earned: m.posts >= 1 },
    { id: 'prolific', emoji: '✍️', label: 'Prolific', description: '10+ posts', earned: m.posts >= 10 },
    { id: 'voice', emoji: '📣', label: 'Loud Voice', description: '50+ posts', earned: m.posts >= 50 },
    { id: 'liked', emoji: '💖', label: 'Crowd Pleaser', description: '25+ reactions received', earned: m.reactionsReceived >= 25 },
    { id: 'viral', emoji: '🚀', label: 'Going Viral', description: '100+ reactions received', earned: m.reactionsReceived >= 100 },
    { id: 'social', emoji: '💬', label: 'Conversationalist', description: '20+ comments given', earned: m.commentsGiven >= 20 },
    { id: 'connector', emoji: '🤝', label: 'Connector', description: '5+ followers', earned: m.followers >= 5 },
    { id: 'veteran', emoji: '🏆', label: 'Veteran', description: '7+ days active', earned: m.daysActive >= 7 },
  ];
}
