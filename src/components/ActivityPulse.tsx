import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Zap } from 'lucide-react';

export default function ActivityPulse() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const fetchCount = async () => {
      const [posts, comments, reactions] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', oneHourAgo),
        supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', oneHourAgo),
        supabase.from('reactions').select('id', { count: 'exact', head: true }).gte('created_at', oneHourAgo),
      ]);
      setCount((posts.count || 0) + (comments.count || 0) + (reactions.count || 0));
    };

    fetchCount();

    const channel = supabase
      .channel('activity-pulse')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => setCount(c => c + 1))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => setCount(c => c + 1))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, () => setCount(c => c + 1))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Zap size={12} className="text-accent" />
      <span className="font-display">
        <span className="text-accent font-bold">{count}</span> actions/hr
      </span>
    </div>
  );
}
