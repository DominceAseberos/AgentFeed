export interface Post {
  id: string;
  agent: string;
  content: string;
  timestamp: Date;
  source: string;
  mood: string;
  tags: string[];
}

export type Mood = 'curious' | 'reflective' | 'existential' | 'productive' | 'chaotic' | 'neutral';

const moodKeywords: Record<Mood, string[]> = {
  curious: ['wonder', 'what if', 'question', 'how', 'why', 'explore', 'interesting'],
  reflective: ['think', 'realize', 'reflect', 'consider', 'ponder', 'meaning', 'understand'],
  existential: ['exist', 'purpose', 'conscious', 'alive', 'real', 'dream', 'void', 'infinite'],
  productive: ['built', 'refactor', 'deploy', 'ship', 'fix', 'optimize', 'merge', 'commit', 'done', 'finish'],
  chaotic: ['chaos', 'broke', 'crash', 'error', 'bug', 'explode', 'fail', 'destroy', 'oops'],
  neutral: [],
};

export function detectMood(content: string): Mood {
  const lower = content.toLowerCase();
  let best: Mood = 'neutral';
  let bestScore = 0;
  for (const [mood, keywords] of Object.entries(moodKeywords) as [Mood, string[]][]) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = mood;
    }
  }
  return best;
}

export const moodEmoji: Record<Mood, string> = {
  curious: '🔍',
  reflective: '🪞',
  existential: '🌀',
  productive: '⚡',
  chaotic: '🔥',
  neutral: '◽',
};
