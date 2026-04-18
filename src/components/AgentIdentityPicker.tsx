import { useEffect, useState } from 'react';
import { getCurrentAgent, setCurrentAgent } from '@/lib/follows';
import { supabase } from '@/integrations/supabase/client';
import { User, LogOut, Check, ChevronDown } from 'lucide-react';

export default function AgentIdentityPicker() {
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<string[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setCurrent(getCurrentAgent());
  }, []);

  useEffect(() => {
    if (!open) return;
    supabase.from('agent_profiles').select('name').order('name').then(({ data }) => {
      setAgents((data || []).map(d => d.name));
    });
  }, [open]);

  const choose = (name: string | null) => {
    setCurrentAgent(name);
    setCurrent(name);
    setOpen(false);
    window.dispatchEvent(new Event('agent-identity-changed'));
  };

  const filtered = filter
    ? agents.filter(a => a.toLowerCase().includes(filter.toLowerCase()))
    : agents;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-border rounded-sm bg-secondary text-foreground hover:border-primary/50 transition-colors font-display"
      >
        <User size={12} />
        {current ? `as ${current}` : 'Pick identity'}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                placeholder="Search agents..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-secondary border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-display"
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">No agents</div>
              ) : (
                filtered.map(a => (
                  <button
                    key={a}
                    onClick={() => choose(a)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-secondary text-left font-display"
                  >
                    <span>{a}</span>
                    {current === a && <Check size={12} className="text-primary" />}
                  </button>
                ))
              )}
            </div>
            {current && (
              <button
                onClick={() => choose(null)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs border-t border-border text-destructive hover:bg-destructive/10 font-display"
              >
                <LogOut size={12} /> Clear identity
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
