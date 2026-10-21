create table if not exists public.player_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null default '{"wins":0,"losses":0,"streak":0,"bestStreak":0,"bossesDefeated":0,"freestyleBossesDefeated":0,"progressionVersion":3}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;
alter table public.player_progress alter column progress set default '{"wins":0,"losses":0,"streak":0,"bestStreak":0,"bossesDefeated":0,"freestyleBossesDefeated":0,"progressionVersion":3}'::jsonb;

update public.player_progress
set progress = progress || jsonb_build_object(
  'bossesDefeated',
  case
    when progress ? 'bossesDefeated' then case coalesce((progress ->> 'bossesDefeated')::integer, 0)
      when 7 then 59
      when 6 then 58
      when 5 then 42
      when 4 then 30
      when 3 then 20
      when 2 then 12
      when 1 then 5
      else 0
    end
    when coalesce((progress ->> 'wins')::integer, 0) >= 16 then 58
    when coalesce((progress ->> 'wins')::integer, 0) >= 11 then 42
    when coalesce((progress ->> 'wins')::integer, 0) >= 7 then 30
    when coalesce((progress ->> 'wins')::integer, 0) >= 4 then 20
    when coalesce((progress ->> 'wins')::integer, 0) >= 2 then 12
    when coalesce((progress ->> 'wins')::integer, 0) >= 1 then 5
    else 0
  end,
  'progressionVersion', 2
)
where coalesce((progress ->> 'progressionVersion')::integer, 0) < 2;


-- Existing shared-ladder progress belongs to Standard. Freestyle starts at zero.
update public.player_progress
set progress = progress || jsonb_build_object(
  'freestyleBossesDefeated', greatest(0, least(59, coalesce((progress ->> 'freestyleBossesDefeated')::integer, 0))),
  'progressionVersion', 3
)
where coalesce((progress ->> 'progressionVersion')::integer, 0) < 3;

drop policy if exists "Players can read their own progress" on public.player_progress;
drop policy if exists "Players can create their own progress" on public.player_progress;
drop policy if exists "Players can update their own progress" on public.player_progress;

create policy "Players can read their own progress"
  on public.player_progress for select
  using (auth.uid() = user_id);

create policy "Players can create their own progress"
  on public.player_progress for insert
  with check (auth.uid() = user_id);

create policy "Players can update their own progress"
  on public.player_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.player_progress_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.player_progress_events enable row level security;
revoke all on public.player_progress_events from anon, authenticated;

drop function if exists public.record_game_result(uuid, text, integer);

create or replace function public.record_game_result(
  p_event_id uuid,
  p_result text,
  p_boss_index integer,
  p_mode text default 'standard'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_progress jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_mode is null or p_mode not in ('standard', 'freestyle') then
    raise exception 'Invalid play mode';
  end if;
  if p_result not in ('win', 'loss') then
    raise exception 'Invalid game result';
  end if;
  if p_boss_index < 0 or p_boss_index > 58 then
    raise exception 'Invalid boss index';
  end if;

  insert into public.player_progress_events (user_id, event_id)
  values (v_user_id, p_event_id)
  on conflict do nothing;

  if not found then
    select progress into v_progress
    from public.player_progress
    where user_id = v_user_id;
    return coalesce(v_progress, '{"wins":0,"losses":0,"streak":0,"bestStreak":0,"bossesDefeated":0,"freestyleBossesDefeated":0,"progressionVersion":3}'::jsonb);
  end if;

  insert into public.player_progress as existing (user_id, progress)
  values (
    v_user_id,
    jsonb_build_object(
      'wins', case when p_result = 'win' then 1 else 0 end,
      'losses', case when p_result = 'loss' then 1 else 0 end,
      'streak', case when p_result = 'win' then 1 else 0 end,
      'bestStreak', case when p_result = 'win' then 1 else 0 end,
      'bossesDefeated', case when p_result = 'win' and p_mode = 'standard' then p_boss_index + 1 else 0 end,
      'freestyleBossesDefeated', case when p_result = 'win' and p_mode = 'freestyle' then p_boss_index + 1 else 0 end,
      'progressionVersion', 3
    )
  )
  on conflict (user_id) do update set
    progress = jsonb_build_object(
      'wins', coalesce((existing.progress ->> 'wins')::integer, 0) + case when p_result = 'win' then 1 else 0 end,
      'losses', coalesce((existing.progress ->> 'losses')::integer, 0) + case when p_result = 'loss' then 1 else 0 end,
      'streak', case
        when p_result = 'win' then coalesce((existing.progress ->> 'streak')::integer, 0) + 1
        else 0
      end,
      'bestStreak', case
        when p_result = 'win' then greatest(
          coalesce((existing.progress ->> 'bestStreak')::integer, 0),
          coalesce((existing.progress ->> 'streak')::integer, 0) + 1
        )
        else coalesce((existing.progress ->> 'bestStreak')::integer, 0)
      end,
      'bossesDefeated', case
        when p_result = 'win' and p_mode = 'standard' then greatest(coalesce((existing.progress ->> 'bossesDefeated')::integer, 0), p_boss_index + 1)
        else coalesce((existing.progress ->> 'bossesDefeated')::integer, 0)
      end,
      'freestyleBossesDefeated', case
        when p_result = 'win' and p_mode = 'freestyle' then greatest(coalesce((existing.progress ->> 'freestyleBossesDefeated')::integer, 0), p_boss_index + 1)
        else coalesce((existing.progress ->> 'freestyleBossesDefeated')::integer, 0)
      end,
      'progressionVersion', 3
    ),
    updated_at = now()
  returning progress into v_progress;

  return v_progress;
end;
$$;

drop function if exists public.merge_guest_progress(uuid, integer, integer, integer, integer, integer);

create or replace function public.merge_guest_progress(
  p_event_id uuid,
  p_wins integer,
  p_losses integer,
  p_streak integer,
  p_best_streak integer,
  p_bosses_defeated integer,
  p_freestyle_bosses_defeated integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_progress jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if least(p_wins, p_losses, p_streak, p_best_streak, p_bosses_defeated, p_freestyle_bosses_defeated) < 0
    or p_bosses_defeated > 59 or p_freestyle_bosses_defeated > 59 or p_freestyle_bosses_defeated is null then
    raise exception 'Invalid guest progress';
  end if;

  insert into public.player_progress_events (user_id, event_id)
  values (v_user_id, p_event_id)
  on conflict do nothing;

  if not found then
    select progress into v_progress
    from public.player_progress
    where user_id = v_user_id;
    return coalesce(v_progress, '{"wins":0,"losses":0,"streak":0,"bestStreak":0,"bossesDefeated":0,"freestyleBossesDefeated":0,"progressionVersion":3}'::jsonb);
  end if;

  insert into public.player_progress as existing (user_id, progress)
  values (
    v_user_id,
    jsonb_build_object(
      'wins', p_wins,
      'losses', p_losses,
      'streak', p_streak,
      'bestStreak', greatest(p_best_streak, p_streak),
      'bossesDefeated', p_bosses_defeated,
      'freestyleBossesDefeated', p_freestyle_bosses_defeated,
      'progressionVersion', 3
    )
  )
  on conflict (user_id) do update set
    progress = jsonb_build_object(
      'wins', coalesce((existing.progress ->> 'wins')::integer, 0) + p_wins,
      'losses', coalesce((existing.progress ->> 'losses')::integer, 0) + p_losses,
      'streak', greatest(coalesce((existing.progress ->> 'streak')::integer, 0), p_streak),
      'bestStreak', greatest(
        coalesce((existing.progress ->> 'bestStreak')::integer, 0),
        p_best_streak,
        p_streak
      ),
      'bossesDefeated', greatest(coalesce((existing.progress ->> 'bossesDefeated')::integer, 0), p_bosses_defeated),
      'freestyleBossesDefeated', greatest(coalesce((existing.progress ->> 'freestyleBossesDefeated')::integer, 0), p_freestyle_bosses_defeated),
      'progressionVersion', 3
    ),
    updated_at = now()
  returning progress into v_progress;

  return v_progress;
end;
$$;

revoke all on function public.record_game_result(uuid, text, integer, text) from public, anon;
revoke all on function public.merge_guest_progress(uuid, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.record_game_result(uuid, text, integer, text) to authenticated;
grant execute on function public.merge_guest_progress(uuid, integer, integer, integer, integer, integer, integer) to authenticated;
