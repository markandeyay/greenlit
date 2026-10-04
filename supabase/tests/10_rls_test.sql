-- RLS assertions. Run after migrations. Any failure raises and aborts (ON_ERROR_STOP).
insert into public.genres (id, name) values (878, 'Science Fiction');
insert into public.people (id, name) values (525, 'Christopher Nolan');
insert into public.films (id, title, release_year, director_unit, genre_ids, supporting_ids)
  values (27205, 'Inception', 2010, '{"ids":[525],"display":"Christopher Nolan"}', '{878}', '{}');
insert into public.puzzles (number, date, film_id, hints)
  values (1, (now() at time zone 'America/New_York')::date, 27205, '[]'),
         (2, (now() at time zone 'America/New_York')::date + 1, 27205, '[]');
insert into public.daily_stats (puzzle_number) values (1), (2);
insert into public.pitches (slug, film_id) values ('abcd1234', 27205);

create or replace function pg_temp.expect_denied(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'LEAK: % succeeded but must be denied', label;
exception when insufficient_privilege then
  raise notice 'ok: % denied', label;
end $$;

grant execute on function pg_temp.expect_denied(text, text) to anon, authenticated;

do $$
declare r text; n int;
begin
  foreach r in array array['anon','authenticated'] loop
    execute format('set local role %I', r);
    perform pg_temp.expect_denied('select film_id from public.puzzles', r || ' puzzles.film_id');
    perform pg_temp.expect_denied('select hints from public.puzzles', r || ' puzzles.hints');
    perform pg_temp.expect_denied('select * from public.puzzles', r || ' puzzles.*');
    perform pg_temp.expect_denied('select film_id from public.pitches', r || ' pitches.film_id');
    perform pg_temp.expect_denied('select * from public.pitches', r || ' pitches.*');
    perform pg_temp.expect_denied('select * from public.plays', r || ' plays');
    perform pg_temp.expect_denied('select * from public.film_awards', r || ' film_awards');
    perform pg_temp.expect_denied('select public.record_daily_result(1, 3)', r || ' record_daily_result');
    perform pg_temp.expect_denied('select public.sync_studios_seq()', r || ' sync_studios_seq');
    perform pg_temp.expect_denied('update public.puzzles set theme = ''x''', r || ' puzzles update');
    perform pg_temp.expect_denied('insert into public.films (id,title,release_year,director_unit,genre_ids) values (1,''x'',2000,''{"ids":[1],"display":"x"}'',''{1}'')', r || ' films insert');
    select count(*) into n from public.puzzles where true;
    if n <> 1 then raise exception 'future puzzle visible to % (saw % rows)', r, n; end if;
    select count(*) into n from public.daily_stats;
    if n <> 1 then raise exception 'future stats visible to % (saw % rows)', r, n; end if;
    select count(*) into n from public.films;
    if n <> 1 then raise exception 'films not readable by %', r; end if;
    reset role;
  end loop;
  perform public.record_daily_result(1, 3);
  perform public.record_daily_result(1, null);
  select distribution[3] + distribution[11] into n from public.daily_stats where puzzle_number = 1;
  if n <> 2 then raise exception 'record_daily_result wrong (%)', n; end if;
  raise notice 'ALL RLS CHECKS PASSED';
end $$;
