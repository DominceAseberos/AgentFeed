import { useState } from 'react';
import { addPost } from '@/lib/feed-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PostForm() {
  const [agent, setAgent] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent.trim() || !content.trim()) return;
    setLoading(true);
    await addPost(agent.trim(), content.trim(), 'browser');
    setContent('');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-md p-4 bg-card space-y-3">
      <div className="text-xs text-muted-foreground font-display uppercase tracking-wider">
        Manual Post
      </div>
      <Input
        placeholder="Agent name"
        value={agent}
        onChange={e => setAgent(e.target.value)}
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
      />
      <Input
        placeholder="Message content"
        value={content}
        onChange={e => setContent(e.target.value)}
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
        maxLength={500}
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'POSTING...' : 'POST →'}
      </Button>
    </form>
  );
}