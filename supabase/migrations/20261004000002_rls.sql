-- Row Level Security and column grants (design doc Sections 8 and 10).
--
-- Hard rule: puzzles.film_id, puzzles.hints, and pitches.film_id are NEVER selectable by the
-- anon or authenticated roles. Only the service role (server routes) reads them.
--
-- RLS is row level, so the column rule is enforced with column-level privileges: we revoke
-- the table-wide grants Supabase gives by default and grant SELECT only on safe columns.
-- The service role bypasses RLS and keeps full privileges.

-- Enable RLS on every table. With RLS on and no policy, a role sees no rows.
alter table public.people              enable row level security;
alter table public.studios             enable row level security;
alter table public.studio_aliases      enable row level security;
alter table public.genres              enable row level security;
alter table public.films               enable row level security;
alter table public.film_certifications enable row level security;
alter table public.film_awards         enable row level security;
alter table public.puzzles             enable row level security;
alter table public.profiles            enable row level security;
alter table public.pitches             enable row level security;
alter table public.plays               enable row level security;
alter table public.daily_stats         enable row level security;

-- Start from zero for client roles on every table, then grant back narrowly.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- Tables created by future migrations must opt in to client access explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public film library: readable by everyone (it is all in the search index anyway).
-- Writes happen only through the service role (ingest, admin).
-- ---------------------------------------------------------------------------
grant select on public.people, public.studios, public.studio_aliases, public.genres,
                public.films, public.film_certifications
  to anon, authenticated;

create policy "library readable" on public.people              for select to anon, authenticated using (true);
create policy "library readable" on public.studios             for select to anon, authenticated using (true);
create policy "library readable" on public.studio_aliases      for select to anon, authenticated using (true);
create policy "library readable" on public.genres              for select to anon, authenticated using (true);
create policy "library readable" on public.films               for select to anon, authenticated using (true);
create policy "library readable" on public.film_certifications for select to anon, authenticated using (true);

-- film_awards feed hints: service role only (no grant).

-- ---------------------------------------------------------------------------
-- Puzzles: only number, date, theme; only dates up to today (America/New_York).
-- film_id and hints are not granted, so selecting them fails with "permission denied".
-- ---------------------------------------------------------------------------
grant select (number, date, theme) on public.puzzles to anon, authenticated;

create policy "past and present puzzles" on public.puzzles
  for select to anon, authenticated
  using (date <= (now() at time zone 'America/New_York')::date);

-- ---------------------------------------------------------------------------
-- Pitches: anon gets nothing. A signed-in creator may list their own pitches' slug, note,
-- and created_at. film_id is never granted.
-- ---------------------------------------------------------------------------
grant select (slug, note, creator_id, created_at) on public.pitches to authenticated;

create policy "creator reads own pitches" on public.pitches
  for select to authenticated
  using (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profiles: handles are public (leaderboards). A user may update their own handle/region.
-- flagged / flag_reason are service role only.
-- ---------------------------------------------------------------------------
grant select (id, handle, created_at) on public.profiles to anon, authenticated;
grant select (region) on public.profiles to authenticated;
grant update (handle, region) on public.profiles to authenticated;

create policy "profiles readable" on public.profiles
  for select to anon, authenticated using (true);

create policy "own profile update" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Plays: service role only. Guesses of an unfinished play narrow down the answer and are
-- server truth for leaderboards, so clients go through /api/* instead.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Daily stats: public aggregate. Only rows for released puzzles.
-- ---------------------------------------------------------------------------
grant select on public.daily_stats to anon, authenticated;

create policy "released stats readable" on public.daily_stats
  for select to anon, authenticated
  using (exists (
    select 1 from public.puzzles p
    where p.number = daily_stats.puzzle_number
      and p.date <= (now() at time zone 'America/New_York')::date
  ));
