-- Run after schema.sql. Mini-game saves never modify competitive ladder results.
create table if not exists public.starship_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  repaired integer not null default 0 check (repaired between 0 and 6),
  launched boolean not null default false,
  check (not launched or repaired = 6)
);
alter table public.starship_progress enable row level security;
revoke all on public.starship_progress from anon, authenticated;

create or replace function public.save_starship_progress(p_repaired integer, p_launched boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.starship_progress;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_repaired is null or p_repaired < 0 or p_repaired > 6 or p_launched is null or (p_launched and p_repaired <> 6) then
    raise exception 'Invalid starship progress';
  end if;
  insert into public.starship_progress as saved (user_id, repaired, launched)
  values (auth.uid(), p_repaired, p_launched)
  on conflict (user_id) do update set repaired = greatest(saved.repaired, excluded.repaired), launched = saved.launched or excluded.launched
  returning * into result;
  return jsonb_build_object('repaired', result.repaired, 'launched', result.launched);
end;
$$;
revoke all on function public.save_starship_progress(integer, boolean) from public, anon;
grant execute on function public.save_starship_progress(integer, boolean) to authenticated;
