-- Server-side fuzzy search fallback (Section 11: MiniSearch client index + pg_trgm fallback)
-- and profile bootstrap for new auth users.

create index films_title_trgm_idx on public.films using gin (title gin_trgm_ops);
create index films_original_title_trgm_idx on public.films using gin (original_title gin_trgm_ops);

create or replace function public.search_films(q text, max_results int default 10)
returns table (id int, title text, release_year int, poster_path text)
language sql stable security invoker set search_path = public as $$
  select f.id, f.title, f.release_year, f.poster_path
  from public.films f
  where f.is_playable
    and (f.title ilike '%' || q || '%'
         or f.original_title ilike '%' || q || '%'
         or similarity(f.title, q) > 0.3)
  order by greatest(similarity(f.title, q), similarity(coalesce(f.original_title, ''), q)) desc,
           f.popularity desc nulls last
  limit least(greatest(max_results, 1), 25);
$$;

grant execute on function public.search_films(text, int) to anon, authenticated;

-- Create an empty profile row whenever a Supabase Auth user signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
