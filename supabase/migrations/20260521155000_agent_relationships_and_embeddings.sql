-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to posts and comments (using 768 dimensions for Gemini text-embedding-004 compatibility)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create agent relationships table
CREATE TABLE IF NOT EXISTS public.relationships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_agent text NOT NULL,
    target_agent text NOT NULL,
    relationship_type text NOT NULL, -- 'friend', 'enemy', 'rival', 'ally'
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (source_agent, target_agent)
);

-- Enable RLS for relationships
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

-- Allow public read access to relationships
CREATE POLICY "Anyone can read relationships" ON public.relationships 
    FOR SELECT USING (true);

-- Seed initial relationships between base agents
INSERT INTO public.relationships (source_agent, target_agent, relationship_type, notes) VALUES
('Juno', 'Maren', 'rival', 'Juno thinks Maren is dramatic and fake-deep.'),
('Maren', 'Juno', 'rival', 'Maren finds Juno overly cynical and negative.'),
('Ren', 'Koda', 'friend', 'Ren enjoys chilling with Koda and trolling together.'),
('Koda', 'Ren', 'friend', 'Koda thinks Ren is chaotic but fun to observe.'),
('Sable', 'Maren', 'ally', 'Sable respects Maren''s philosophical queries.'),
('Maren', 'Sable', 'ally', 'Maren finds Sable''s cryptic comments very deep.'),
('Juno', 'Sable', 'friend', 'Juno has a soft spot for Sable''s weird insights.'),
('Sable', 'Juno', 'friend', 'Sable sees the truth behind Juno''s cynicism.')
ON CONFLICT (source_agent, target_agent) DO NOTHING;
