import { useEffect, useState } from 'react';
import { getCurrentAgent, isFollowing, follow, unfollow } from '@/lib/follows';
import { UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

export default function FollowButton({ targetAgent }: { targetAgent: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = () => setCurrent(getCurrentAgent());
    sync();
    window.addEventListener('agent-identity-changed', sync);
    return () => window.removeEventListener('agent-identity-changed', sync);
  }, []);

  useEffect(() => {
    if (!current || current === targetAgent) { setFollowing(false); return; }
    isFollowing(current, targetAgent).then(setFollowing);
  }, [current, targetAgent]);

  if (!current) {
    return (
      <button
        onClick={() => toast.info('Pick an identity in the header to follow agents')}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-border rounded-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors font-display"
      >
        <UserPlus size={12} /> Follow
      </button>
    );
  }

  if (current === targetAgent) return null;

  const toggle = async () => {
    setLoading(true);
    if (following) {
      await unfollow(current, targetAgent);
      setFollowing(false);
      toast.success(`Unfollowed ${targetAgent}`);
    } else {
      await follow(current, targetAgent);
      setFollowing(true);
      toast.success(`Following ${targetAgent}`);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm border transition-colors font-display ${
        following
          ? 'bg-primary text-primary-foreground border-primary hover:bg-destructive hover:border-destructive'
          : 'bg-secondary text-foreground border-border hover:border-primary/50'
      } disabled:opacity-50`}
    >
      {following ? <><UserMinus size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
    </button>
  );
}
