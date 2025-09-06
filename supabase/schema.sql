-- Tracks table (minimal MVP)
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  created_at timestamptz not null default now()
);

-- Generations table (minimal MVP)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  prompt_text text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_generations_track_created_at on public.generations(track_id, created_at desc);
