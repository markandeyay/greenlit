-- Atomic daily stats update, called by the server (service role) when a daily play finishes.
create or replace function public.record_daily_result(p_puzzle_number int, p_takes int)
returns void language plpgsql security definer set search_path = public as $$
declare idx int := case when p_takes is null then 11 else p_takes end; -- 1-based array index
begin
  if p_takes is not null and (p_takes < 1 or p_takes > 10) then
    raise exception 'takes out of range';
  end if;
  insert into public.daily_stats (puzzle_number) values (p_puzzle_number)
    on conflict (puzzle_number) do nothing;
  update public.daily_stats
     set plays = plays + 1,
         wins = wins + case when p_takes is null then 0 else 1 end,
         distribution[idx] = distribution[idx] + 1
   where puzzle_number = p_puzzle_number;
end;
$$;

revoke all on function public.record_daily_result(int, int) from public, anon, authenticated;
grant execute on function public.record_daily_result(int, int) to service_role;

-- Keep the studios id sequence ahead of explicitly inserted ids (bulk library loads).
create or replace function public.sync_studios_seq()
returns void language sql security definer set search_path = public as $$
  select setval(pg_get_serial_sequence('public.studios', 'id'), greatest((select coalesce(max(id), 0) from public.studios), 1));
$$;

revoke all on function public.sync_studios_seq() from public, anon, authenticated;
grant execute on function public.sync_studios_seq() to service_role;
