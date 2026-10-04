-- Greenlit schema (design doc Section 8, plus Section 9.1 additions).
-- All tables have created_at and updated_at.

create extension if not exists pg_trgm;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Film library
-- ---------------------------------------------------------------------------

create table public.people (
  id            int primary key,                -- TMDB person id
  name          text not null,
  profile_path  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.studios (
  id            serial primary key,
  name          text not null unique,
  logo_path     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.studio_aliases (
  raw_company_id int primary key,               -- TMDB production company id
  studio_id      int not null references public.studios(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.genres (
  id            int primary key,                -- TMDB genre id
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.films (
  id                 int primary key,           -- TMDB movie id
  title              text not null,
  original_title     text,
  release_year       int not null,
  release_date       date,
  poster_path        text,
  backdrop_path      text,
  runtime_min        int,
  box_office_usd     bigint,                    -- nullable
  score_snapshot     int check (score_snapshot between 0 and 100), -- frozen at ingest
  studio_id          int references public.studios(id),
  director_unit      jsonb not null,            -- {"ids":[525], "display":"Christopher Nolan"}
  lead_person_id     int references public.people(id),
  supporting_ids     int[] not null default '{}' check (cardinality(supporting_ids) <= 4),
  genre_ids          int[] not null check (cardinality(genre_ids) between 1 and 5),
  trailer_youtube    text,
  tagline            text,
  keywords           text[] not null default '{}', -- 9.1 addition: for hint generation
  popularity         real,                      -- for difficulty bands
  is_playable        boolean not null default true,   -- appears in search
  is_answer_eligible boolean not null default false,  -- curated for dailies
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint director_unit_shape check (
    jsonb_typeof(director_unit -> 'ids') = 'array'
    and jsonb_array_length(director_unit -> 'ids') >= 1
    and jsonb_typeof(director_unit -> 'display') = 'string'
  )
);

create index films_playable_idx on public.films (is_playable) where is_playable;
create index films_eligible_idx on public.films (is_answer_eligible) where is_answer_eligible;

create table public.film_certifications (
  film_id     int not null references public.films(id) on delete cascade,
  region      text not null check (region in ('US','GB','CA','AU','IN','DE')),
  rating      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (film_id, region)
);

-- 9.1 addition: curated awards blurbs (written in-house) for the hint generator.
create table public.film_awards (
  id          serial primary key,
  film_id     int not null references public.films(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index film_awards_film_idx on public.film_awards (film_id);

-- ---------------------------------------------------------------------------
-- Scheduling (answers: service role only, see RLS migration)
-- ---------------------------------------------------------------------------

create table public.puzzles (
  number      int primary key,                  -- Reel number
  date        date unique not null,             -- in America/New_York
  film_id     int not null references public.films(id),
  theme       text,                             -- e.g. "Nolan Week"
  hints       jsonb not null check (jsonb_typeof(hints) = 'array'), -- 3 candidates [{type, payload}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index puzzles_film_idx on public.puzzles (film_id);

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  handle      text unique check (handle ~ '^[A-Za-z0-9_]{3,20}$'),
  region      text check (region in ('US','GB','CA','AU','IN','DE')),
  flagged     boolean not null default false,   -- 9.1 addition: hidden from boards pending review
  flag_reason text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Custom challenges (answers: service role only)
-- ---------------------------------------------------------------------------

create table public.pitches (
  slug        text primary key check (slug ~ '^[0-9a-z]{8}$'), -- 8 char random, base36
  film_id     int not null references public.films(id),
  note        text check (char_length(note) <= 140),            -- moderated
  creator_id  uuid null references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index pitches_creator_idx on public.pitches (creator_id);

-- ---------------------------------------------------------------------------
-- Play records (server truth for leaderboards)
-- ---------------------------------------------------------------------------

create table public.plays (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid null references public.profiles(id) on delete set null, -- null for anonymous
  anon_id        uuid not null,                 -- device id cookie
  kind           text not null,                 -- 'daily' | 'vault' | 'pitch' | mode name
  ref            text not null,                 -- puzzle number or pitch slug
  guesses        int[] not null default '{}',   -- film ids in order
  hints_used     text[] not null default '{}',
  status         text not null default 'in_progress' check (status in ('in_progress','won','lost')),
  takes          int check (takes between 0 and 10),
  started_at     timestamptz not null default now(),
  first_guess_at timestamptz,                   -- 9.1 addition: anti-cheat timing
  finished_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (anon_id, kind, ref)
);
create index plays_profile_idx on public.plays (profile_id, kind, ref);
create index plays_kind_ref_idx on public.plays (kind, ref);

-- ---------------------------------------------------------------------------
-- Aggregates
-- ---------------------------------------------------------------------------

create table public.daily_stats (
  puzzle_number int primary key references public.puzzles(number) on delete cascade,
  distribution  int[] not null default array_fill(0, array[11]) check (cardinality(distribution) = 11),
  plays         int not null default 0,
  wins          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'people','studios','studio_aliases','genres','films','film_certifications','film_awards',
    'puzzles','profiles','pitches','plays','daily_stats'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
