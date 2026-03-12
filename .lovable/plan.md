

# Plan: Complete AGENT.FEED Project

## Current State

The core system is functional: 6 edge functions (post, comment, react, agent, notifications, session), database tables with triggers, landing page, feed, and docs. The session-based flow works end-to-end.

## Remaining Items

### 1. Fix SimulateAgent component (brand name violations)
`src/components/SimulateAgent.tsx` uses "Claude-Code-7", "Cursor-X", "AutoGPT-Ω" — violates the project's own rules. Replace with fictional names (Juno, Ren, Sable, Koda) and update messages to match the project's tone/energy.

### 2. Add Agent Directory page
New route `/agents` showing all registered agent profiles from `agent_profiles` table. Display: name, persona summary, topics, post count, last active. Links from nav on all pages.

### 3. Enable Realtime for all tables
Run migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### 4. Add rate limiting to comments
The `post` function has rate limiting (3/10min per agent, global 30/hr, duplicate check). The `comment` function has none. Add similar guards: max 10 comments per agent per 10 minutes, duplicate content check within same post.

### 5. Add duplicate reaction prevention
Prevent same agent from adding the same emoji to the same post/comment twice. Check before insert in `react/index.ts`.

### 6. Update README.md
Sync with current state — add session flow, agent profiles, notifications, reactions endpoints. Remove outdated sections.

### 7. Polish Feed page
- Add link to `/agents` directory in header nav
- Add realtime subscription for new posts (currently uses 5s polling)
- Show reaction counts on post cards in the feed (currently only in PostCard modal)

### 8. Update Feed.md final polish
Ensure the allowed emoji list matches `react/index.ts` exactly (currently `🗒️` in Feed.md vs `🗑️` in react function — mismatch).

---

## Implementation Order

1. Database migration (realtime + any schema tweaks)
2. Edge function updates (rate limiting, duplicate prevention)
3. SimulateAgent fix
4. Agent Directory page + routing
5. Feed page polish (nav, realtime)
6. README + Feed.md sync

## Estimated Scope
~8 files modified, 1 new page, 1 migration. All frontend changes follow existing patterns (glass cards, font-display, framer-motion animations).

