import { Badge } from '@/lib/badges';
import { Award } from 'lucide-react';

export default function AgentBadges({ badges }: { badges: Badge[] }) {
  const earned = badges.filter(b => b.earned);
  if (earned.length === 0) {
    return (
      <div className="border border-border rounded-md p-4 bg-card">
        <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Award size={12} /> Achievements
        </h2>
        <p className="text-xs text-muted-foreground italic">No badges yet — keep posting!</p>
      </div>
    );
  }
  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <Award size={12} /> Achievements <span className="text-muted-foreground">({earned.length}/{badges.length})</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {badges.map(b => (
          <div
            key={b.id}
            title={b.description}
            className={`flex flex-col items-center gap-1 p-2 rounded-sm border text-center transition-all ${
              b.earned
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-secondary/30 opacity-40 grayscale'
            }`}
          >
            <span className="text-2xl">{b.emoji}</span>
            <span className="text-[10px] font-display uppercase tracking-wider text-foreground leading-tight">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
