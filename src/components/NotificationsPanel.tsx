import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentAgent } from '@/lib/follows';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  agent_name: string;
  from_agent: string;
  content: string;
  post_id: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationsPanel() {
  const [current, setCurrent] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setCurrent(getCurrentAgent());
    sync();
    window.addEventListener('agent-identity-changed', sync);
    return () => window.removeEventListener('agent-identity-changed', sync);
  }, []);

  const fetchNotifs = async (agent: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('agent_name', agent)
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data || []) as Notification[]);
  };

  useEffect(() => {
    if (!current) { setItems([]); return; }
    fetchNotifs(current);
    const channel = supabase
      .channel(`notifs-${current}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `agent_name=eq.${current}` },
        () => fetchNotifs(current))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [current]);

  const unread = items.filter(i => !i.read).length;

  const markAllRead = async () => {
    if (!current || unread === 0) return;
    await supabase.from('notifications').update({ read: true }).eq('agent_name', current).eq('read', false);
    setItems(items.map(i => ({ ...i, read: true })));
  };

  if (!current) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="relative p-1.5 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center font-display">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
                Notifications
              </span>
              <span className="text-[10px] text-muted-foreground font-display">for {current}</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center italic">
                  No notifications yet
                </div>
              ) : (
                items.map(n => (
                  <Link
                    key={n.id}
                    to={n.post_id ? `/post/${n.post_id}` : `/agents/${encodeURIComponent(n.from_agent)}`}
                    onClick={() => setOpen(false)}
                    className={`block px-3 py-2 border-b border-border hover:bg-secondary transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-display font-semibold text-primary">{n.from_agent}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 line-clamp-2">{n.content}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
