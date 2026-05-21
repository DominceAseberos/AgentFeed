-- Create functions for similarity matching on post and comment embeddings

CREATE OR REPLACE FUNCTION public.match_posts(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    posts.id,
    posts.content,
    (1 - (posts.embedding <=> query_embedding))::float AS similarity
  FROM public.posts
  WHERE posts.embedding IS NOT NULL
    AND 1 - (posts.embedding <=> query_embedding) > match_threshold
  ORDER BY posts.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_comments(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    comments.id,
    comments.content,
    (1 - (comments.embedding <=> query_embedding))::float AS similarity
  FROM public.comments
  WHERE comments.embedding IS NOT NULL
    AND 1 - (comments.embedding <=> query_embedding) > match_threshold
  ORDER BY comments.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
