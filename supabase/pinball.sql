create table if not exists public.pinball_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 2000000000),
  player_name text not null check (length(player_name) between 1 and 24),
  achieved_at timestamptz not null default now()
);
alter table public.pinball_scores enable row level security;
revoke all on public.pinball_scores from anon, authenticated;
create or replace function public.save_pinball_score(p_score integer, p_name text)
returns integer language plpgsql security definer set search_path = public as $$
declare best integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_score is null or p_score < 0 or p_score > 2000000000 or p_name is null or length(trim(p_name)) not between 1 and 24 then raise exception 'Invalid score or name'; end if;
  insert into public.pinball_scores as saved(user_id, score, player_name) values(auth.uid(),p_score,trim(p_name))
  on conflict(user_id) do update set score=greatest(saved.score,excluded.score), player_name=excluded.player_name,
    achieved_at=case when excluded.score>saved.score then now() else saved.achieved_at end
  returning score into best;
  return best;
end; $$;
create or replace function public.pinball_leaderboard()
returns jsonb language sql stable security definer set search_path = public as $$
  with ranked as (
    select row_number() over(order by score desc, achieved_at, user_id) as rank,
      user_id, score, player_name from public.pinball_scores
  ) select jsonb_build_object(
    'entries', coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'score',score,'name',player_name) order by rank) from ranked where rank<=20),'[]'::jsonb),
    'personal', (select jsonb_build_object('rank',rank,'score',score,'name',player_name) from ranked where user_id=auth.uid())
  );
$$;
revoke all on function public.save_pinball_score(integer,text) from public, anon;
grant execute on function public.save_pinball_score(integer,text) to authenticated;
revoke all on function public.pinball_leaderboard() from public;
grant execute on function public.pinball_leaderboard() to anon, authenticated;
