-- Run after schema.sql and multiplayer.sql in each environment.
begin;

create table if not exists public.app_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
create table if not exists public.app_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);
create index if not exists app_presence_last_seen on public.app_presence(last_seen);
-- Keep aggregate history after account deletion, without names, emails or PGNs.
create table if not exists public.app_completed_games (
  game_key text primary key,
  completed_at timestamptz not null
);
create index if not exists app_completed_games_time on public.app_completed_games(completed_at);
alter table public.app_administrators enable row level security;
alter table public.app_presence enable row level security;
alter table public.app_completed_games enable row level security;
revoke all on public.app_administrators, public.app_presence, public.app_completed_games from public, anon, authenticated;

-- Read Auth's current verified email, never editable user_metadata or JWT role claims.
create or replace function public.app_role()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when lower(u.email) = 'ekim197711@gmail.com' and u.email_confirmed_at is not null then 'super_administrator'
    when u.email_confirmed_at is not null and exists (select 1 from public.app_administrators a where a.user_id = u.id) then 'administrator'
    else 'player' end
  from auth.users u where u.id = auth.uid() and not coalesce(u.is_anonymous, false);
$$;

create or replace function public.app_heartbeat()
returns text language plpgsql security definer set search_path = '' as $$
declare v_role text := public.app_role();
begin
  if v_role is null then raise exception 'Authentication required'; end if;
  insert into public.app_presence(user_id) values(auth.uid())
  on conflict(user_id) do update set last_seen = now();
  return v_role;
end;
$$;

create or replace function public.admin_statistics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := now(); v_games jsonb;
begin
  if coalesce(public.app_role(), 'player') not in ('administrator', 'super_administrator') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'today', count(*) filter(where completed_at >= (date_trunc('day', v_now at time zone 'Europe/Copenhagen') at time zone 'Europe/Copenhagen')),
    'hour', count(*) filter(where completed_at >= v_now - interval '1 hour'),
    'week', count(*) filter(where completed_at >= v_now - interval '7 days'),
    'month', count(*)
  ) into v_games from public.app_completed_games
  where completed_at >= v_now - interval '30 days' and completed_at <= v_now;
  return jsonb_build_object(
    'users', (select count(*) from auth.users where not coalesce(is_anonymous, false)),
    'online', (select count(*) from public.app_presence where last_seen >= v_now - interval '90 seconds'),
    'games', v_games, 'asOf', v_now
  );
end;
$$;

create or replace function public.admin_users(p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if public.app_role() is distinct from 'super_administrator' then
    raise exception 'Super administrator access required' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 or length(p_search) > 200 then raise exception 'Invalid search'; end if;
  return (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
    select u.id, u.email,
      case when lower(u.email) = 'ekim197711@gmail.com' and u.email_confirmed_at is not null then 'super_administrator'
        when a.user_id is not null then 'administrator' else 'player' end as role,
      u.email_confirmed_at is not null as verified
    from auth.users u left join public.app_administrators a on a.user_id = u.id
    where not coalesce(u.is_anonymous, false) and position(lower(coalesce(p_search, '')) in lower(coalesce(u.email, ''))) > 0
    order by u.created_at desc, u.id limit 50 offset p_offset
  ) t);
end;
$$;

create or replace function public.admin_set_administrator(p_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text; v_verified timestamptz;
begin
  if public.app_role() is distinct from 'super_administrator' then
    raise exception 'Super administrator access required' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'Role selection required'; end if;
  select email, email_confirmed_at into v_email, v_verified from auth.users
    where id = p_user_id and not coalesce(is_anonymous, false) for update;
  if not found then raise exception 'User not found'; end if;
  if lower(v_email) = 'ekim197711@gmail.com' then raise exception 'The super administrator role cannot be changed'; end if;
  if p_enabled then
    if v_verified is null then raise exception 'User must verify their email first'; end if;
    insert into public.app_administrators(user_id, granted_by) values(p_user_id, auth.uid()) on conflict do nothing;
  else
    delete from public.app_administrators where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.track_completed_game()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'player_games' then
    if new.game ->> 'result' in ('win','loss','draw') and coalesce(new.game ->> 'debug', 'false') <> 'true' then
      insert into public.app_completed_games values ('boss:' || new.user_id || ':' || new.id, least((new.game ->> 'updatedAt')::timestamptz, now())) on conflict do nothing;
    end if;
  elsif new.result is not null then
    insert into public.app_completed_games values ('online:' || new.id, coalesce(new.finished_at, now())) on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists track_completed_boss_game on public.player_games;
create trigger track_completed_boss_game after insert or update on public.player_games
  for each row execute function public.track_completed_game();
drop trigger if exists track_completed_online_game on public.online_games;
create trigger track_completed_online_game after insert or update on public.online_games
  for each row execute function public.track_completed_game();

-- Backfill once per game; rerunning the migration or resaving cannot double count.
insert into public.app_completed_games
select 'boss:' || user_id || ':' || id, least((game ->> 'updatedAt')::timestamptz, now())
from public.player_games where game ->> 'result' in ('win','loss','draw')
  and coalesce(game ->> 'debug', 'false') <> 'true' on conflict do nothing;
insert into public.app_completed_games
select 'online:' || id, coalesce(finished_at, created_at) from public.online_games where result is not null on conflict do nothing;

revoke all on function public.app_role(), public.app_heartbeat(), public.admin_statistics(), public.admin_users(text,integer),
  public.admin_set_administrator(uuid,boolean), public.track_completed_game() from public, anon, authenticated;
grant execute on function public.app_role(), public.app_heartbeat(), public.admin_statistics(), public.admin_users(text,integer),
  public.admin_set_administrator(uuid,boolean) to authenticated;
commit;
