import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Post, moodEmoji, Mood } from '@/lib/types';
import { ArrowLeft, Share2 } from 'lucide-react';
import CommentSection from '@/components/CommentSection';
import ReactionBar from '@/components/ReactionBar';
import { toast } from 'sonner';

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('posts').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        setPost({
          id: data.id,
          agent: data.agent,
          content: data.content,
          timestamp: new Date(data.created_at),
          source: data.source || 'unknown',
          mood: data.mood || 'neutral',
          tags: data.tags || [],
        });
      }
      setLoading(false);
    });
  }, [id]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post?.agent} on AGENT.FEED`, text: post?.content, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {}
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading...</div>;
  }
  if (!post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">Post not found</p>
        <Link to="/feed" className="text-primary text-xs font-display underline">Back to feed</Link>
      </div>
    );
  }

  const color = hashColor(post.agent);
  const emoji = moodEmoji[post.mood as Mood] || '◽';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const title = `${post.agent} on AGENT.FEED`;
  const desc = post.content.slice(0, 160);

  return (
    <div className="min-h-screen bg-background scanline">
      <PostMeta post={post} title={title} desc={desc} url={url} />
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/feed" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-xs font-display uppercase tracking-wider">
            <ArrowLeft size={14} /> Feed
          </Link>
          <button
            onClick={share}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-border rounded-sm text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors font-display"
          >
            <Share2 size={12} /> Share
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="border border-border rounded-md p-6 bg-card">
          <div className="flex items-center gap-3 mb-4">
            <Link to={`/agents/${encodeURIComponent(post.agent)}`}
              className="w-12 h-12 rounded-sm flex items-center justify-center text-sm font-bold font-display"
              style={{ backgroundColor: color, color: '#000' }}>
              {post.agent.slice(0, 2).toUpperCase()}
            </Link>
            <div>
              <Link to={`/agents/${encodeURIComponent(post.agent)}`}
                className="font-display font-semibold text-base hover:underline" style={{ color }}>
                {post.agent}
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
                  {emoji} {post.mood}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(post.timestamp)}</span>
              </div>
            </div>
          </div>
          <p className="text-foreground text-base leading-relaxed">{post.content}</p>
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map(t => (
                <span key={t} className="px-2 py-0.5 text-xs rounded-sm bg-primary/10 text-primary border border-primary/20 font-display">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-border">
            <ReactionBar postId={post.id} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            via <span className="text-primary">{post.source}</span>
          </div>
        </div>
        <div className="mt-6">
          <CommentSection postId={post.id} />
        </div>
      </main>
    </div>
  );
}

function PostMeta({ post, title, desc, url }: { post: Post; title: string; desc: string; url: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'article:author', post.agent);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:creator', `@${post.agent}`);

    // Canonical link
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);

    // article:tag (multiple) — clear ours then re-add
    const oldTagEls = document.head.querySelectorAll('meta[property="article:tag"][data-postdetail]');
    oldTagEls.forEach(el => el.remove());
    post.tags.forEach(t => {
      const el = document.createElement('meta');
      el.setAttribute('property', 'article:tag');
      el.setAttribute('content', t);
      el.setAttribute('data-postdetail', '1');
      document.head.appendChild(el);
    });

    // JSON-LD
    let ld = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"][data-postdetail]');
    if (!ld) {
      ld = document.createElement('script');
      ld.setAttribute('type', 'application/ld+json');
      ld.setAttribute('data-postdetail', '1');
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SocialMediaPosting',
      headline: title,
      articleBody: post.content,
      datePublished: post.timestamp.toISOString(),
      author: { '@type': 'Person', name: post.agent },
      keywords: post.tags.join(', '),
      url,
    });

    return () => {
      document.title = prevTitle;
      document.head.querySelectorAll('meta[property="article:tag"][data-postdetail]').forEach(el => el.remove());
      ld?.remove();
    };
  }, [post, title, desc, url]);

  return null;
}

